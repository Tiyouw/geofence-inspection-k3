import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { areas, assets, assetTypes, inspections, schedules, users } from "@/db/schema";
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
            sql`unnest(string_to_array(${daftarPeriode.join(",")}, ',')::date[]) as p(periode)`,
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

/* ---------- Kalender jadwal (redesain A) ---------- */

/** Tempat pengelompokan aset di kalender: nama area, atau teks gedung lama, atau '' (tanpa gedung). */
const tempatSql = sql<string>`coalesce(${areas.nama}, ${assets.gedung}, '')`;

export type KelompokRencana = {
    tanggal: string;
    tipeSlug: string;
    tipeNama: string;
    tempat: string;
    periode: string;
    jumlah: number;
    selesai: number;
};

/**
 * Pemeriksaan yang sudah direncanakan pada [awal, akhir] (inklusif, "YYYY-MM-DD"),
 * dikelompokkan per tanggal, tipe, tempat, dan periode.
 */
export async function rencanaKalender(awal: string, akhir: string): Promise<KelompokRencana[]> {
    const rows = await db
        .select({
            tanggal: sql<string>`to_char(${schedules.tanggalRencana}, 'YYYY-MM-DD')`,
            tipeSlug: assetTypes.slug,
            tipeNama: assetTypes.nama,
            tempat: tempatSql,
            periode: sql<string>`to_char(${schedules.periode}, 'YYYY-MM-DD')`,
            jumlah: sql<number>`count(*)::int`,
            selesai: sql<number>`count(*) filter (where ${schedules.status} <> 'belum')::int`,
        })
        .from(schedules)
        .innerJoin(assets, eq(assets.id, schedules.assetId))
        .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
        .leftJoin(areas, eq(areas.id, assets.areaId))
        .where(and(eq(assets.aktif, true), sql`${schedules.tanggalRencana} between ${awal}::date and ${akhir}::date`))
        .groupBy(schedules.tanggalRencana, assetTypes.slug, assetTypes.nama, assetTypes.urut, tempatSql, schedules.periode)
        .orderBy(asc(schedules.tanggalRencana), asc(assetTypes.urut), asc(tempatSql));
    return rows;
}

export type KelompokBelum = {
    tipeSlug: string;
    tipeNama: string;
    tempat: string;
    periode: string;
    jatuhTempo: string;
    jumlah: number;
};

/**
 * Aset aktif yang belum punya tanggal rencana untuk periode yang dimulai di bulan `p`
 * (dan belum diperiksa, tenggat belum lewat), dikelompokkan per tipe, tempat, dan periode: daftar "Belum dijadwalkan".
 */
export async function belumDijadwalkan(p: Periode, hariIni: string): Promise<KelompokBelum[]> {
    const tipe = await db
        .select({ id: assetTypes.id, slug: assetTypes.slug, nama: assetTypes.nama, periodeHari: assetTypes.periodeHari })
        .from(assetTypes)
        .where(eq(assetTypes.aktif, true))
        .orderBy(asc(assetTypes.urut));
    const hasil: KelompokBelum[] = [];
    for (const t of tipe) {
        const daftar = periodeDalamBulan(p.tanggal, t.periodeHari);
        const rows = await db
            .select({
                tempat: tempatSql,
                periode: sql<string>`to_char(p.periode, 'YYYY-MM-DD')`,
                jumlah: sql<number>`count(*)::int`,
            })
            .from(assets)
            .innerJoin(sql`unnest(string_to_array(${daftar.join(",")}, ',')::date[]) as p(periode)`, sql`true`)
            .leftJoin(areas, eq(areas.id, assets.areaId))
            .leftJoin(schedules, and(eq(schedules.assetId, assets.id), sql`${schedules.periode} = p.periode`))
            .where(
                and(
                    eq(assets.aktif, true),
                    eq(assets.assetTypeId, t.id),
                    sql`${schedules.tanggalRencana} is null`,
                    sql`coalesce(${schedules.status}, 'belum') = 'belum'`,
                ),
            )
            .groupBy(tempatSql, sql`p.periode`)
            .orderBy(sql`p.periode`, asc(tempatSql));
        for (const r of rows) {
            // Periode yang tenggatnya sudah lewat tidak bisa dijadwalkan lagi (terlihat di Daftar per aset).
            if (jatuhTempoUntuk(r.periode, t.periodeHari) < hariIni) continue;
            hasil.push({
                tipeSlug: t.slug,
                tipeNama: t.nama,
                tempat: r.tempat,
                periode: r.periode,
                jatuhTempo: jatuhTempoUntuk(r.periode, t.periodeHari),
                jumlah: r.jumlah,
            });
        }
    }
    return hasil;
}
