"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { areas, assets } from "@/db/schema";
import { buatTokenQr } from "@/lib/domain/asset";
import { skemaAset, type MasukanAset } from "../lib/skema";
import { aksiAdmin, catatAudit, dariForm, langgarUnik, type HasilAksi } from "../server/aksi";

/** Nama gedung lama (teks) disalin dari area supaya tampilan lama tetap terisi. */
async function namaArea(areaId: number | null): Promise<string | null> {
    if (!areaId) return null;
    const [a] = await db.select({ nama: areas.nama }).from(areas).where(eq(areas.id, areaId));
    return a?.nama ?? null;
}

function nilaiKolom(d: MasukanAset, gedung: string | null) {
    const attributes: Record<string, unknown> = {};
    if (d.jenis) attributes.jenis = d.jenis;
    if (d.kapasitasKg !== null) attributes.kapasitas_kg = d.kapasitasKg;
    return {
        assetTypeId: d.assetTypeId,
        kode: d.kode,
        divisionId: d.divisionId,
        aktif: d.aktif,
        areaId: d.areaId,
        gedung,
        lantai: d.lantai,
        lokasiTeks: d.lokasiTeks,
        lat: d.lat,
        lng: d.lng,
        tglExpired: d.tglExpired,
        attributes,
    };
}

const PESAN_KODE_GANDA: HasilAksi<never> = {
    ok: false,
    status: 422,
    pesan: "Periksa kembali isian yang ditandai.",
    galat: { kode: ["Nomor aset ini sudah dipakai untuk tipe objek yang sama."] },
};

/** Aset baru selalu mendapat token acak dari peladen (C1); formulir tidak bisa mengirim token. */
export async function buatAset(_prev: unknown, fd: FormData): Promise<HasilAksi<{ id: number }>> {
    return aksiAdmin<typeof skemaAset, { id: number }>(skemaAset, dariForm(fd), async (d, user) => {
        try {
            const id = await db.transaction(async (tx) => {
                const [baru] = await tx
                    .insert(assets)
                    .values({ ...nilaiKolom(d, await namaArea(d.areaId)), qrToken: buatTokenQr() })
                    .returning({ id: assets.id });
                await catatAudit(tx, user, "aset.buat", "asset", baru!.id, { kode: d.kode });
                return baru!.id;
            });
            revalidatePath("/admin/aset");
            return { ok: true, pesan: "Aset tersimpan.", data: { id } };
        } catch (e) {
            if (langgarUnik(e)) return PESAN_KODE_GANDA;
            throw e;
        }
    });
}

export async function ubahAset(id: number, _prev: unknown, fd: FormData): Promise<HasilAksi> {
    return aksiAdmin(skemaAset, dariForm(fd), async (d, user) => {
        try {
            const ada = await db.transaction(async (tx) => {
                const [lama] = await tx.select().from(assets).where(eq(assets.id, id)).for("update");
                if (!lama) return false;
                const baru = nilaiKolom(d, d.areaId ? await namaArea(d.areaId) : lama.gedung);
                await tx.update(assets).set(baru).where(eq(assets.id, id));
                const berubah = Object.fromEntries(
                    Object.entries(baru)
                        .filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(lama[k as keyof typeof lama] ?? null))
                        .map(([k, v]) => [k, { dari: lama[k as keyof typeof lama] ?? null, ke: v }]),
                );
                await catatAudit(tx, user, "aset.ubah", "asset", id, { kode: d.kode, berubah });
                return true;
            });
            if (!ada) return { ok: false, status: 404, pesan: "Aset tidak ditemukan." };
            revalidatePath("/admin/aset");
            revalidatePath(`/admin/aset/${id}`);
            return { ok: true, pesan: "Perubahan tersimpan." };
        } catch (e) {
            if (langgarUnik(e)) return PESAN_KODE_GANDA;
            throw e;
        }
    });
}

/**
 * "Ganti token" (C7): stiker lama langsung mati dan wajib dicetak ulang.
 * Token baru tidak dikembalikan ke klien; dicetak lewat /stiker.
 */
export async function gantiTokenAset(id: number): Promise<HasilAksi> {
    return aksiAdmin(z.number().int().positive(), id, async (assetId, user) => {
        const ok = await db.transaction(async (tx) => {
            const [r] = await tx
                .update(assets)
                .set({ qrToken: buatTokenQr(), qrTokenRotatedAt: new Date() })
                .where(eq(assets.id, assetId))
                .returning({ kode: assets.kode });
            if (!r) return false;
            await catatAudit(tx, user, "aset.ganti_token", "asset", assetId, { kode: r.kode });
            return true;
        });
        if (!ok) return { ok: false, status: 404, pesan: "Aset tidak ditemukan." };
        revalidatePath(`/admin/aset/${assetId}`);
        return { ok: true, pesan: "Token diganti. Stiker lama tidak berlaku lagi; cetak ulang stiker aset ini." };
    });
}

/** Menampilkan token di tabel/aset hanya atas permintaan admin, dan dicatat. */
export async function lihatTokenAset(id: number): Promise<HasilAksi<{ token: string }>> {
    return aksiAdmin(z.number().int().positive(), id, async (assetId, user) => {
        const [r] = await db
            .select({ t: assets.qrToken, kode: assets.kode })
            .from(assets)
            .where(eq(assets.id, assetId));
        if (!r) return { ok: false, status: 404, pesan: "Aset tidak ditemukan." };
        await catatAudit(db, user, "aset.lihat_token", "asset", assetId, { kode: r.kode });
        return { ok: true, data: { token: r.t } };
    });
}
