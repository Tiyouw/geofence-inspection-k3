"use server";

/**
 * Editor area `/admin/lokasi` (PRD "Impor denah", ADR-10). Semua aksi hanya untuk admin
 * (aksiAdmin), memakai JSON, dan memvalidasi ulang geometri di peladen. Poligon hasil impor
 * dan suntingan disimpan sebagai draf; gerbang hanya memakai poligon yang sudah disetujui.
 */
import { and, count, eq, inArray, isNotNull, isNull, ne, notExists } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { alias } from "drizzle-orm/pg-core";
import { areas, assets, assetTypes, inspections } from "@/db/schema";
import { AREA_JENIS } from "@/lib/domain/constants";
import { type GeometriArea, normalkanGeometri, titikDalamPoligon, validasiGeometri } from "@/lib/geo/geometri";
import { kodeDariLabel, MAKS_FITUR_IMPOR } from "@/lib/geo/impor";
import { aksiAdmin, catatAudit, langgarUnik, type HasilAksi } from "../server/aksi";

const geometri = z.unknown().superRefine((g, ctx) => {
    const v = validasiGeometri(g);
    if (!v.sah) ctx.addIssue({ code: "custom", message: v.pesan });
});
const sahkan = (g: unknown) => normalkanGeometri(g as GeometriArea);

function segarkan() {
    revalidatePath("/admin/lokasi");
    revalidatePath("/admin/aset");
    revalidatePath("/pemantau");
}

async function idKawasan(): Promise<number | null> {
    const [k] = await db
        .select({ id: areas.id })
        .from(areas)
        .where(and(eq(areas.jenis, "kawasan"), eq(areas.aktif, true)))
        .orderBy(areas.id)
        .limit(1);
    return k?.id ?? null;
}

/* ---------- impor ---------- */

const skemaImpor = z.object({
    fitur: z
        .array(z.object({ label: z.string().trim().max(120).nullable(), geometry: geometri }))
        .min(1, "Tidak ada poligon untuk diimpor.")
        .max(MAKS_FITUR_IMPOR),
});

/**
 * Setiap fitur menjadi draf. Label yang cocok dengan area tanpa poligon (mis. area hasil
 * migrasi dari nama gedung lama) mengisi draf area itu; selainnya membuat area baru.
 */
export async function imporArea(masukan: z.input<typeof skemaImpor>): Promise<HasilAksi<{ baru: number; diisi: number }>> {
    return aksiAdmin(skemaImpor, masukan, async (d, user) => {
        const kawasan = await idKawasan();
        const ada = await db.select({ id: areas.id, kode: areas.kode, nama: areas.nama, polygon: areas.polygon, polygonDraf: areas.polygonDraf }).from(areas);
        const kodeDipakai = new Set(ada.map((a) => a.kode));
        const kosongPerNama = new Map(
            ada.filter((a) => !a.polygon && !a.polygonDraf).map((a) => [a.nama.trim().toLowerCase(), a.id]),
        );
        let baru = 0;
        let diisi = 0;
        await db.transaction(async (tx) => {
            for (const [i, f] of d.fitur.entries()) {
                const g = sahkan(f.geometry);
                const nama = f.label || `Poligon impor ${i + 1}`;
                const cocok = f.label ? kosongPerNama.get(f.label.toLowerCase()) : undefined;
                if (cocok) {
                    kosongPerNama.delete(f.label!.toLowerCase());
                    await tx.update(areas).set({ polygonDraf: g }).where(eq(areas.id, cocok));
                    diisi++;
                    continue;
                }
                let kode = kodeDariLabel(nama, `IMPOR-${i + 1}`).slice(0, 28);
                for (let n = 2; kodeDipakai.has(kode); n++) kode = `${kodeDariLabel(nama, "IMPOR").slice(0, 26)}-${n}`;
                kodeDipakai.add(kode);
                await tx.insert(areas).values({ kode, nama, jenis: "gedung", polygonDraf: g, parentId: kawasan });
                baru++;
            }
            // Isi koordinat tidak dicatat: denah bersifat rahasia (ADR-10).
            await catatAudit(tx, user, "area.impor", "area", "-", { jumlah: d.fitur.length, baru, diisi });
        });
        segarkan();
        return { ok: true, pesan: `${baru + diisi} poligon diimpor sebagai draf.`, data: { baru, diisi } };
    });
}

/* ---------- hapus draf massal ---------- */

/** Batas satu kali hapus massal; jauh di atas jumlah area satu denah. */
export const MAKS_HAPUS_DRAF = 2000;

const skemaHapusDraf = z.object({
    ids: z.array(z.number().int().positive()).min(1, "Tidak ada draf yang dipilih.").max(MAKS_HAPUS_DRAF),
});

/**
 * Menghapus banyak area DRAF sekaligus (mis. satu kumpulan impor yang salah berkas).
 * Hanya area yang belum pernah disetujui (polygon null, ada polygon_draf), bukan kawasan,
 * tanpa aset, tanpa inspeksi yang merujuknya, dan tanpa area anak. Syarat diperiksa lagi di
 * dalam DELETE, jadi id yang tidak memenuhi syarat diabaikan, bukan dihapus.
 */
export async function hapusDrafMassal(masukan: z.input<typeof skemaHapusDraf>): Promise<HasilAksi<{ jumlah: number; dilewati: number }>> {
    return aksiAdmin(skemaHapusDraf, masukan, async (d, user) => {
        const ids = [...new Set(d.ids)];
        const anak = alias(areas, "anak");
        const jumlah = await db.transaction(async (tx) => {
            const hapus = await tx
                .delete(areas)
                .where(
                    and(
                        inArray(areas.id, ids),
                        isNull(areas.polygon),
                        isNotNull(areas.polygonDraf),
                        ne(areas.jenis, "kawasan"),
                        notExists(tx.select({ x: assets.id }).from(assets).where(eq(assets.areaId, areas.id))),
                        notExists(tx.select({ x: inspections.id }).from(inspections).where(eq(inspections.detectedAreaId, areas.id))),
                        notExists(tx.select({ x: anak.id }).from(anak).where(eq(anak.parentId, areas.id))),
                    ),
                )
                .returning({ id: areas.id });
            // Isi poligon dan nama tidak dicatat: denah bersifat rahasia (ADR-10).
            await catatAudit(tx, user, "area.hapus_draf_massal", "area", "-", { diminta: ids.length, dihapus: hapus.length });
            return hapus.length;
        });
        segarkan();
        const dilewati = ids.length - jumlah;
        if (jumlah === 0) return { ok: false, status: 422, pesan: "Tidak ada draf yang dapat dihapus." };
        return {
            ok: true,
            pesan: `${jumlah} draf area dihapus.${dilewati ? ` ${dilewati} dilewati karena sudah disetujui, berisi aset, atau dirujuk inspeksi.` : ""}`,
            data: { jumlah, dilewati },
        };
    });
}

/* ---------- atribut ---------- */

const skemaUbah = z.object({
    id: z.number().int().positive(),
    nama: z.string().trim().min(1, "Nama wajib diisi.").max(120),
    kode: z
        .string()
        .trim()
        .min(1, "Kode wajib diisi.")
        .max(32)
        .regex(/^[A-Za-z0-9._-]+$/, "Kode hanya huruf, angka, titik, garis bawah, atau tanda hubung."),
    jenis: z.enum(AREA_JENIS.filter((j) => j !== "kawasan") as [string, ...string[]]),
    divisionId: z.number().int().positive().nullable(),
    restricted: z.boolean(),
});

export async function ubahArea(masukan: z.input<typeof skemaUbah>): Promise<HasilAksi> {
    return aksiAdmin(skemaUbah, masukan, async (d, user) => {
        try {
            const [lama] = await db.select().from(areas).where(eq(areas.id, d.id));
            if (!lama) return { ok: false, status: 404, pesan: "Area tidak ditemukan." };
            // Kawasan tetap kawasan; jenisnya diganti lewat "Jadikan batas kawasan".
            const jenis = lama.jenis === "kawasan" ? "kawasan" : (d.jenis as (typeof AREA_JENIS)[number]);
            const nilai = {
                nama: d.nama,
                kode: d.kode.toUpperCase(),
                jenis,
                divisionId: d.divisionId,
                restricted: lama.jenis === "kawasan" ? false : d.restricted,
            };
            await db.transaction(async (tx) => {
                await tx.update(areas).set(nilai).where(eq(areas.id, d.id));
                await catatAudit(tx, user, "area.ubah", "area", d.id, {
                    dari: { nama: lama.nama, kode: lama.kode, jenis: lama.jenis, divisionId: lama.divisionId, restricted: lama.restricted },
                    ke: nilai,
                });
            });
            segarkan();
            return { ok: true, pesan: "Area tersimpan." };
        } catch (e) {
            if (langgarUnik(e)) return { ok: false, status: 422, pesan: "Kode area sudah dipakai.", galat: { kode: ["Kode area sudah dipakai."] } };
            throw e;
        }
    });
}

/* ---------- poligon ---------- */

const skemaPoligon = z.object({ id: z.number().int().positive(), geometry: geometri });

/** Menyimpan suntingan simpul sebagai draf. */
export async function simpanDrafPoligon(masukan: z.input<typeof skemaPoligon>): Promise<HasilAksi> {
    return aksiAdmin(skemaPoligon, masukan, async (d, user) => {
        const r = await db.transaction(async (tx) => {
            const [a] = await tx.update(areas).set({ polygonDraf: sahkan(d.geometry) }).where(eq(areas.id, d.id)).returning({ id: areas.id });
            if (a) await catatAudit(tx, user, "area.draf", "area", d.id);
            return a;
        });
        if (!r) return { ok: false, status: 404, pesan: "Area tidak ditemukan." };
        segarkan();
        return { ok: true, pesan: "Draf poligon tersimpan. Setujui supaya dipakai gerbang." };
    });
}

const skemaId = z.object({ id: z.number().int().positive() });

/** Draf menjadi poligon resmi yang dipakai gerbang lokasi. */
export async function setujuiPoligon(masukan: z.input<typeof skemaId>): Promise<HasilAksi> {
    return aksiAdmin(skemaId, masukan, async (d, user) => {
        const [a] = await db.select({ draf: areas.polygonDraf }).from(areas).where(eq(areas.id, d.id));
        if (!a) return { ok: false, status: 404, pesan: "Area tidak ditemukan." };
        if (!a.draf) return { ok: false, status: 422, pesan: "Tidak ada draf poligon untuk disetujui." };
        const v = validasiGeometri(a.draf);
        if (!v.sah) return { ok: false, status: 422, pesan: v.pesan };
        await db.transaction(async (tx) => {
            await tx
                .update(areas)
                .set({ polygon: a.draf, polygonDraf: null, poligonDisetujuiPada: new Date(), poligonDisetujuiOleh: user.id })
                .where(eq(areas.id, d.id));
            await catatAudit(tx, user, "area.setujui", "area", d.id);
        });
        segarkan();
        return { ok: true, pesan: "Poligon disetujui dan dipakai gerbang lokasi." };
    });
}

/** Membuang draf; poligon yang sudah disetujui tetap dipakai. */
export async function buangDrafPoligon(masukan: z.input<typeof skemaId>): Promise<HasilAksi> {
    return aksiAdmin(skemaId, masukan, async (d, user) => {
        await db.transaction(async (tx) => {
            await tx.update(areas).set({ polygonDraf: null }).where(eq(areas.id, d.id));
            await catatAudit(tx, user, "area.buang_draf", "area", d.id);
        });
        segarkan();
        return { ok: true, pesan: "Draf dibuang." };
    });
}

const skemaBaru = z.object({
    nama: z.string().trim().min(1, "Nama wajib diisi.").max(120),
    geometry: geometri,
});

/** Area baru yang digambar langsung di peta. */
export async function buatArea(masukan: z.input<typeof skemaBaru>): Promise<HasilAksi<{ id: number }>> {
    return aksiAdmin(skemaBaru, masukan, async (d, user) => {
        const kawasan = await idKawasan();
        const ada = new Set((await db.select({ kode: areas.kode }).from(areas)).map((a) => a.kode));
        let kode = kodeDariLabel(d.nama, "AREA").slice(0, 28);
        for (let n = 2; ada.has(kode); n++) kode = `${kodeDariLabel(d.nama, "AREA").slice(0, 26)}-${n}`;
        const id = await db.transaction(async (tx) => {
            const [a] = await tx
                .insert(areas)
                .values({ kode, nama: d.nama, jenis: "gedung", polygonDraf: sahkan(d.geometry), parentId: kawasan })
                .returning({ id: areas.id });
            await catatAudit(tx, user, "area.buat", "area", a!.id, { kode });
            return a!.id;
        });
        segarkan();
        return { ok: true, pesan: "Area dibuat sebagai draf.", data: { id } };
    });
}

/**
 * Menjadikan area ini batas kawasan galangan. Hanya satu kawasan aktif: kawasan lama
 * dinonaktifkan (tidak dihapus), dan area lain menunjuk kawasan baru sebagai induk.
 */
export async function jadikanKawasan(masukan: z.input<typeof skemaId>): Promise<HasilAksi> {
    return aksiAdmin(skemaId, masukan, async (d, user) => {
        const [a] = await db.select({ id: areas.id }).from(areas).where(eq(areas.id, d.id));
        if (!a) return { ok: false, status: 404, pesan: "Area tidak ditemukan." };
        // Hitung terpisah dengan eq(): subkueri sql`` di select satu tabel membuat kolom tanpa
        // nama tabel, sehingga "id" terikat ke assets.id, bukan ke area ini (bug impor kawasan).
        const [{ jumlah } = { jumlah: 0 }] = await db.select({ jumlah: count() }).from(assets).where(eq(assets.areaId, d.id));
        if (jumlah > 0) {
            return { ok: false, status: 422, pesan: "Area ini masih memiliki aset. Pindahkan asetnya ke gedung lebih dulu." };
        }
        await db.transaction(async (tx) => {
            await tx
                .update(areas)
                .set({ aktif: false })
                .where(and(eq(areas.jenis, "kawasan"), ne(areas.id, d.id)));
            await tx.update(areas).set({ jenis: "kawasan", restricted: false, parentId: null }).where(eq(areas.id, d.id));
            await tx.update(areas).set({ parentId: d.id }).where(and(ne(areas.id, d.id), ne(areas.jenis, "kawasan")));
            await catatAudit(tx, user, "area.kawasan", "area", d.id);
        });
        segarkan();
        return { ok: true, pesan: "Batas kawasan galangan diperbarui." };
    });
}

/** Menonaktifkan area (mis. poligon impor yang tidak dipakai). Aset di dalamnya dilepas. */
export async function hapusArea(masukan: z.input<typeof skemaId>): Promise<HasilAksi> {
    return aksiAdmin(skemaId, masukan, async (d, user) => {
        const r = await db.transaction(async (tx) => {
            const [a] = await tx.update(areas).set({ aktif: false }).where(eq(areas.id, d.id)).returning({ id: areas.id, nama: areas.nama });
            if (!a) return null;
            const lepas = await tx.update(assets).set({ areaId: null }).where(eq(assets.areaId, d.id)).returning({ id: assets.id });
            await catatAudit(tx, user, "area.hapus", "area", d.id, { nama: a.nama, asetDilepas: lepas.length });
            return a;
        });
        if (!r) return { ok: false, status: 404, pesan: "Area tidak ditemukan." };
        segarkan();
        return { ok: true, pesan: "Area dihapus." };
    });
}

/* ---------- pasangkan aset ---------- */

const skemaPasang = z.object({
    areaId: z.number().int().positive().nullable(),
    assetIds: z.array(z.number().int().positive()).min(1, "Pilih sedikitnya satu aset.").max(2000),
});

/** Memasangkan aset ke area (atau melepasnya bila `areaId` null). */
export async function pasangkanAset(masukan: z.input<typeof skemaPasang>): Promise<HasilAksi<{ jumlah: number }>> {
    return aksiAdmin(skemaPasang, masukan, async (d, user) => {
        if (d.areaId !== null) {
            const [a] = await db.select({ jenis: areas.jenis, aktif: areas.aktif }).from(areas).where(eq(areas.id, d.areaId));
            if (!a || !a.aktif) return { ok: false, status: 404, pesan: "Area tidak ditemukan." };
            if (a.jenis === "kawasan") return { ok: false, status: 422, pesan: "Aset dipasangkan ke gedung, bengkel, dok, atau dermaga, bukan ke kawasan." };
        }
        const jumlah = await db.transaction(async (tx) => {
            // Objek bergerak tidak punya area.
            const tetap = await tx
                .select({ id: assets.id })
                .from(assets)
                .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
                .where(and(inArray(assets.id, d.assetIds), eq(assetTypes.isMobile, false)));
            const ids = tetap.map((t) => t.id);
            if (ids.length) await tx.update(assets).set({ areaId: d.areaId }).where(inArray(assets.id, ids));
            await catatAudit(tx, user, "area.pasang_aset", "area", d.areaId ?? "-", { assetIds: ids });
            return ids.length;
        });
        segarkan();
        return { ok: true, pesan: `${jumlah} aset dipasangkan.`, data: { jumlah } };
    });
}

/** Memasangkan semua aset yang titiknya jatuh di dalam poligon area (resmi, atau draf bila belum ada). */
export async function pasangkanAsetDalamPoligon(masukan: z.input<typeof skemaId>): Promise<HasilAksi<{ jumlah: number }>> {
    return aksiAdmin(skemaId, masukan, async (d, user) => {
        const [a] = await db.select().from(areas).where(eq(areas.id, d.id));
        if (!a || !a.aktif) return { ok: false, status: 404, pesan: "Area tidak ditemukan." };
        if (a.jenis === "kawasan") return { ok: false, status: 422, pesan: "Aset dipasangkan ke gedung, bukan ke kawasan." };
        const g = (a.polygon ?? a.polygonDraf) as GeometriArea | null;
        if (!g) return { ok: false, status: 422, pesan: "Area ini belum punya poligon." };
        const kandidat = await db
            .select({ id: assets.id, lat: assets.lat, lng: assets.lng })
            .from(assets)
            .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
            .where(and(isNotNull(assets.lat), isNotNull(assets.lng), eq(assetTypes.isMobile, false)));
        const ids = kandidat.filter((k) => titikDalamPoligon({ lat: k.lat!, lng: k.lng! }, g)).map((k) => k.id);
        if (!ids.length) return { ok: true, pesan: "Tidak ada titik aset di dalam poligon ini.", data: { jumlah: 0 } };
        await db.transaction(async (tx) => {
            await tx.update(assets).set({ areaId: d.id }).where(inArray(assets.id, ids));
            await catatAudit(tx, user, "area.pasang_aset", "area", d.id, { assetIds: ids, otomatis: true });
        });
        segarkan();
        return { ok: true, pesan: `${ids.length} aset di dalam poligon dipasangkan.`, data: { jumlah: ids.length } };
    });
}
