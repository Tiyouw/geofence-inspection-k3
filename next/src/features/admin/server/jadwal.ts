import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetTypes, inspections, schedules, users } from "@/db/schema";
import { jatuhTempoPeriode } from "../lib/label";
import type { Periode } from "../lib/periode";

/**
 * Jadwal kewajiban satu periode: semua aset aktif tipe itu, dengan baris jadwal bila ada.
 * Aset tanpa baris (cron awal periode belum berjalan) ditampilkan dengan tenggat turunan,
 * tanpa menulis apa pun (G11). Pembuatan baris jadwal milik sesi Laporan (G14).
 */
export async function jadwalPeriode(p: Periode, tipeSlug: string) {
    const rows = await db
        .select({
            asetId: assets.id,
            kode: assets.kode,
            gedung: assets.gedung,
            lantai: assets.lantai,
            lokasiTeks: assets.lokasiTeks,
            periodeHari: assetTypes.periodeHari,
            jadwalId: schedules.id,
            status: schedules.status,
            jatuhTempo: schedules.jatuhTempo,
            inspectionId: schedules.inspectionId,
            inspectedAt: inspections.inspectedAt,
            inspektur: users.name,
        })
        .from(assets)
        .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
        .leftJoin(schedules, and(eq(schedules.assetId, assets.id), eq(schedules.periode, p.tanggal)))
        .leftJoin(inspections, eq(inspections.id, schedules.inspectionId))
        .leftJoin(users, eq(users.id, inspections.userId))
        .where(and(eq(assets.aktif, true), eq(assetTypes.slug, tipeSlug)))
        .orderBy(asc(assets.gedung), asc(assets.lantai), asc(assets.kode));

    return rows.map((r) => ({
        ...r,
        status: r.status ?? ("belum" as const),
        jatuhTempo: r.jatuhTempo ?? jatuhTempoPeriode(p.tanggal, r.periodeHari),
        adaBaris: r.jadwalId !== null,
    }));
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
            jumlahAset: sql<number>`(select count(*)::int from ${assets} where ${assets.assetTypeId} = ${assetTypes.id} and ${assets.aktif})`,
        })
        .from(assetTypes)
        .orderBy(asc(assetTypes.urut));
}
