"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { areas, assets, assetTypes, schedules } from "@/db/schema";
import { jatuhTempoUntuk } from "@/lib/domain/jadwal";
import { formatTanggal } from "@/lib/format";
import { skemaJadwalkan, skemaKelompokJadwal } from "../lib/skema";
import { aksiAdmin, catatAudit, dariForm, type HasilAksi } from "../server/aksi";

const tglPanjang = (t: string) => formatTanggal(`${t}T12:00:00+07:00`, { day: "numeric", month: "long" });

/**
 * Jadwalkan satu kelompok (jenis + tempat + periode) pada tanggal rencana, atau pindahkan ke tanggal lain.
 * Baris jadwal yang belum ada dibuat (idempoten dengan cron awal periode: kunci unik aset+periode);
 * hanya baris yang belum diperiksa yang tanggalnya berubah. Tanggal harus di dalam periode.
 */
export async function jadwalkanKelompok(_prev: unknown, fd: FormData): Promise<HasilAksi> {
    return aksiAdmin(skemaJadwalkan, dariForm(fd), async (d, user) => {
        const [tipe] = await db
            .select({ id: assetTypes.id, nama: assetTypes.nama, periodeHari: assetTypes.periodeHari })
            .from(assetTypes)
            .where(eq(assetTypes.slug, d.tipe));
        if (!tipe) return { ok: false, status: 404, pesan: "Jenis peralatan tidak ditemukan." };
        const tempo = jatuhTempoUntuk(d.periode, tipe.periodeHari);
        if (d.tanggal < d.periode || d.tanggal > tempo) {
            return {
                ok: false,
                status: 422,
                pesan: `Tanggal harus di dalam periodenya: ${tglPanjang(d.periode)} sampai ${tglPanjang(tempo)}.`,
                galat: { tanggal: ["Di luar periode pemeriksaan."] },
            };
        }
        const jumlah = await db.transaction(async (tx) => {
            const r = await tx.execute(sql`
                insert into ${schedules} (asset_id, periode, jatuh_tempo, tanggal_rencana)
                select a.id, ${d.periode}::date, ${tempo}::date, ${d.tanggal}::date
                from ${assets} a left join ${areas} ar on ar.id = a.area_id
                where a.aktif and a.asset_type_id = ${tipe.id} and coalesce(ar.nama, a.gedung, '') = ${d.tempat}
                on conflict (asset_id, periode) do update set tanggal_rencana = excluded.tanggal_rencana, updated_at = now()
                where ${schedules}.status = 'belum'`);
            const n = r.rowCount ?? 0;
            if (n > 0)
                await catatAudit(tx, user, "jadwal.rencana", "asset_type", tipe.id, {
                    tempat: d.tempat || null,
                    periode: d.periode,
                    tanggal: d.tanggal,
                    jumlah: n,
                });
            return n;
        });
        if (jumlah === 0) return { ok: false, status: 404, pesan: "Tidak ada aset yang belum diperiksa di kelompok ini." };
        revalidatePath("/admin/jadwal");
        return {
            ok: true,
            pesan: `${tipe.nama} ${d.tempat || "tanpa gedung"} (${jumlah} unit) dijadwalkan ${tglPanjang(d.tanggal)}.`,
        };
    });
}

/** Lepaskan tanggal rencana sebuah kelompok; kembali ke daftar "Belum dijadwalkan". */
export async function batalkanRencana(_prev: unknown, fd: FormData): Promise<HasilAksi> {
    return aksiAdmin(skemaKelompokJadwal, dariForm(fd), async (d, user) => {
        const [tipe] = await db
            .select({ id: assetTypes.id, nama: assetTypes.nama })
            .from(assetTypes)
            .where(eq(assetTypes.slug, d.tipe));
        if (!tipe) return { ok: false, status: 404, pesan: "Jenis peralatan tidak ditemukan." };
        const n = await db.transaction(async (tx) => {
            const r = await tx
                .update(schedules)
                .set({ tanggalRencana: null })
                .where(
                    and(
                        eq(schedules.periode, d.periode),
                        eq(schedules.status, "belum"),
                        sql`${schedules.assetId} in (select a.id from ${assets} a left join ${areas} ar on ar.id = a.area_id
                            where a.asset_type_id = ${tipe.id} and coalesce(ar.nama, a.gedung, '') = ${d.tempat})`,
                    ),
                )
                .returning({ id: schedules.id });
            if (r.length)
                await catatAudit(tx, user, "jadwal.batal_rencana", "asset_type", tipe.id, {
                    tempat: d.tempat || null,
                    periode: d.periode,
                    jumlah: r.length,
                });
            return r.length;
        });
        if (n === 0) return { ok: false, status: 404, pesan: "Tidak ada jadwal yang bisa dilepas." };
        revalidatePath("/admin/jadwal");
        return { ok: true, pesan: `${tipe.nama} ${d.tempat || "tanpa gedung"} dikembalikan ke daftar belum dijadwalkan.` };
    });
}
