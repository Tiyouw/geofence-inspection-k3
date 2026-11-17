import "server-only";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { areas, assetTypes, assets, inspections, issues } from "@/db/schema";
import { jatuhTempoUntuk, mingguan, periodeUntuk, rentangPeriode } from "@/lib/domain/jadwal";
import { lokasiTemuan } from "@/lib/domain/temuan";
import { hariIniJakarta } from "@/lib/format";
import { rakitProgres, type AsetProgres, type CekTerakhir } from "./rakit";

/**
 * Progres pemeriksaan lintas modul (PRD F14) untuk dasbor Admin K3 dan papan Pemantau.
 * Setiap modul dinilai pada periodenya sendiri: bulan berjalan, atau minggu berjalan untuk
 * mobil pemadam. Hanya membaca.
 */
export async function progresSemuaModul(now = new Date()) {
    const hariIni = hariIniJakarta(now);
    const tipe = await db
        .select({
            id: assetTypes.id,
            slug: assetTypes.slug,
            nama: assetTypes.nama,
            periodeHari: assetTypes.periodeHari,
        })
        .from(assetTypes)
        .where(eq(assetTypes.aktif, true))
        .orderBy(asc(assetTypes.urut));
    const modul = tipe.map((t) => {
        const periode = periodeUntuk(hariIni, t.periodeHari);
        return {
            ...t,
            periode,
            jatuhTempo: jatuhTempoUntuk(periode, t.periodeHari),
            mingguan: mingguan(t.periodeHari),
            rentang: rentangPeriode(periode, t.periodeHari),
        };
    });
    const awalTerlama = new Date(Math.min(now.getTime(), ...modul.map((m) => m.rentang.awal.getTime())));

    const [asetRows, terakhir] = await Promise.all([
        db
            .select({
                id: assets.id,
                kode: assets.kode,
                assetTypeId: assets.assetTypeId,
                gedung: assets.gedung,
                lantai: assets.lantai,
                lokasiTeks: assets.lokasiTeks,
                area: areas.nama,
                lat: assets.lat,
                lng: assets.lng,
            })
            .from(assets)
            .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
            .leftJoin(areas, eq(areas.id, assets.areaId))
            .where(and(eq(assets.aktif, true), eq(assetTypes.aktif, true)))
            .orderBy(asc(assets.kode)),
        db
            .selectDistinctOn([inspections.assetId], {
                assetId: inspections.assetId,
                inspectedAt: inspections.inspectedAt,
                kesimpulan: inspections.kesimpulan,
            })
            .from(inspections)
            .where(and(eq(inspections.status, "final"), gte(inspections.inspectedAt, awalTerlama)))
            .orderBy(inspections.assetId, desc(inspections.inspectedAt), desc(inspections.id)),
    ]);

    const modulPerId = new Map(modul.map((m) => [m.id, m]));
    const aset: (AsetProgres & { lat: number | null; lng: number | null })[] = asetRows.map((a) => {
        const m = modulPerId.get(a.assetTypeId)!;
        return {
            id: a.id,
            kode: a.kode,
            modulSlug: m.slug,
            modul: m.nama,
            area: a.area ?? a.gedung,
            lokasi: lokasiTemuan({ lantai: a.lantai, lokasiTeks: a.lokasiTeks }),
            lat: a.lat,
            lng: a.lng,
        };
    });
    const tipeAset = new Map(asetRows.map((a) => [a.id, a.assetTypeId]));
    const cek = new Map<number, CekTerakhir>();
    for (const t of terakhir) {
        const m = modulPerId.get(tipeAset.get(t.assetId) ?? -1);
        if (m && t.inspectedAt && t.inspectedAt >= m.rentang.awal) cek.set(t.assetId, { kesimpulan: t.kesimpulan });
    }
    return { modul, aset, cek, ...rakitProgres(modul, aset, cek) };
}

/** Jumlah temuan per tingkat sejak `sejak` (temuan lahir saat inspeksi final). */
export async function temuanSejak(sejak: Date) {
    const rows = await db
        .select({ severity: issues.severity, n: sql<number>`count(*)::int` })
        .from(issues)
        .leftJoin(inspections, eq(inspections.id, issues.inspectionId))
        .where(gte(sql`coalesce(${inspections.inspectedAt}, ${issues.createdAt})`, sejak))
        .groupBy(issues.severity);
    const per = new Map(rows.map((r) => [r.severity, r.n]));
    return { berat: per.get("berat") ?? 0, sedang: per.get("sedang") ?? 0, ringan: per.get("ringan") ?? 0 };
}

/** Aset yang diperiksa per bulan, 6 bulan terakhir, semua modul (tren). */
export async function trenEnamBulan(awal: Date, akhir: Date) {
    return db
        .select({
            bulan: sql<string>`to_char(${inspections.inspectedAt} at time zone 'Asia/Jakarta', 'YYYY-MM')`,
            n: sql<number>`count(distinct ${inspections.assetId})::int`,
        })
        .from(inspections)
        .where(
            and(
                eq(inspections.status, "final"),
                gte(inspections.inspectedAt, awal),
                lt(inspections.inspectedAt, akhir),
            ),
        )
        .groupBy(sql`1`);
}
