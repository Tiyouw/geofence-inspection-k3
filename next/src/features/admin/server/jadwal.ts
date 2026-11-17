import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetTypes, inspections, schedules, users } from "@/db/schema";
import { jatuhTempoUntuk, mingguan, periodeDalamBulan } from "@/lib/domain/jadwal";
import type { Periode } from "../lib/periode";

/**
 * Jadwal kewajiban satu bulan: semua aset aktif tipe itu, dengan baris jadwal bila ada.
 * Tipe mingguan (mobil pemadam) mendapat satu baris per aset per minggu yang dimulai di bulan itu.
 * Aset tanpa baris (cron awal periode belum berjalan) ditampilkan dengan tenggat turunan,
 * tanpa menulis apa pun (G11). Pembuatan baris jadwal milik sesi Laporan (G14).
 */
export async function jadwalPeriode(p: Periode, tipeSlug: string) {
    const [tipe] = await db
        .select({ periodeHari: assetTypes.periodeHari })
        .from(assetTypes)
        .where(eq(assetTypes.slug, tipeSlug));
    const daftarPeriode = periodeDalamBulan(p.tanggal, tipe?.periodeHari ?? 30);
    const rows = await db
        .select({
            asetId: assets.id,
            kode: assets.kode,
            gedung: assets.gedung,
            lantai: assets.lantai,
            lokasiTeks: assets.lokasiTeks,
            periodeHari: assetTypes.periodeHari,
            periode: sql<string>`to_char(p.periode, 'YYYY-MM-DD')`,
            jadwalId: schedules.id,
            status: schedules.status,
            jatuhTempo: schedules.jatuhTempo,
            inspectionId: schedules.inspectionId,
            inspectedAt: inspections.inspectedAt,
            inspektur: users.name,
        })
        .from(assets)
        .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
        .innerJoin(
            sql`unnest(array[${daftarPeriode}]::date[]) as p(periode)`,
            sql`true`,
        )
        .leftJoin(schedules, and(eq(schedules.assetId, assets.id), sql`${schedules.periode} = p.periode`))
        .leftJoin(inspections, eq(inspections.id, schedules.inspectionId))
        .leftJoin(users, eq(users.id, inspections.userId))
        .where(and(eq(assets.aktif, true), eq(assetTypes.slug, tipeSlug)))
        .orderBy(asc(assets.gedung), asc(assets.lantai), asc(assets.kode), sql`p.periode`);

    return rows.map((r) => {
        const periode = r.periode;
        return {
            ...r,
            mingguan: mingguan(r.periodeHari),
            status: r.status ?? ("belum" as const),
            jatuhTempo: r.jatuhTempo ?? jatuhTempoUntuk(periode, r.periodeHari),
            adaBaris: r.jadwalId !== null,
        };
    });
}

export async function daftarTipe() {
    return db
        .select({
            id: assetTypes.id,
            slug: assetTypes.slug,
            nama: assetTypes.nama,
            periodeHari: assetTypes.periodeHari,
            isMobile: assetTypes.isMobile,
            aktif: assetTypes.aktif,
            jumlahAset: sql<number>`(select count(*)::int from ${assets} a where a.asset_type_id = ${assetTypes}.id and a.aktif)`,
        })
        .from(assetTypes)
        .orderBy(asc(assetTypes.urut));
}
