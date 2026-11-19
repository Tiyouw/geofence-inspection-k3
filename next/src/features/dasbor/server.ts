import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { areas, assetTypes, assets, inspections, issues } from "@/db/schema";
import { jatuhTempoUntuk, mingguan, periodeDalamBulan, periodeUntuk, rentangPeriode } from "@/lib/domain/jadwal";
import { lokasiTemuan } from "@/lib/domain/temuan";
import { hariIniJakarta } from "@/lib/format";
import { namaGedung, rakitProgres, type AsetProgres, type CekTerakhir } from "./rakit";

export type OpsiProgres = {
    /** "YYYY-MM-01": periode yang dimulai di bulan itu (minggu-minggunya untuk mobil pemadam). Kosong = periode berjalan. */
    bulan?: string;
    /** Slug tipe aset; kosong = semua modul aktif. */
    modul?: string;
};

export type SlotProgres = AsetProgres & {
    asetId: number;
    periode: string;
    lat: number | null;
    lng: number | null;
    /** Area aset (untuk menaruh titik di poligon areanya). */
    areaId: number | null;
};

/**
 * Progres pemeriksaan lintas modul (PRD F14, F15) untuk dasbor Admin K3, papan Pemantau, dan
 * laporan "Progres per gedung". Satu jalur hitung untuk ketiganya, supaya angkanya sama:
 * - periode berjalan (bawaan): setiap modul pada periodenya sendiri, bulan berjalan atau minggu
 *   berjalan untuk mobil pemadam; satu slot per aset aktif;
 * - `bulan`: setiap periode yang dimulai di bulan itu; slot = aset × periode (mobil pemadam
 *   mendapat satu slot per minggu).
 * Slot "sudah" bila ada inspeksi final di rentang periodenya; kondisi = kesimpulan terakhir.
 * Hanya membaca.
 */
export async function progres(opsi: OpsiProgres = {}, now = new Date()) {
    const hariIni = hariIniJakarta(now);
    const tipe = await db
        .select({
            id: assetTypes.id,
            slug: assetTypes.slug,
            nama: assetTypes.nama,
            periodeHari: assetTypes.periodeHari,
            ownerDivisionId: assetTypes.ownerDivisionId,
        })
        .from(assetTypes)
        .where(and(eq(assetTypes.aktif, true), opsi.modul ? eq(assetTypes.slug, opsi.modul) : undefined))
        .orderBy(asc(assetTypes.urut));
    const modul = tipe.map((t) => {
        const daftar = opsi.bulan ? periodeDalamBulan(opsi.bulan, t.periodeHari) : [periodeUntuk(hariIni, t.periodeHari)];
        const periode = daftar.map((p) => ({ periode: p, rentang: rentangPeriode(p, t.periodeHari) }));
        return {
            ...t,
            periode: daftar[0]!,
            jatuhTempo: jatuhTempoUntuk(daftar.at(-1)!, t.periodeHari),
            mingguan: mingguan(t.periodeHari),
            rentang: { awal: periode[0]!.rentang.awal, akhir: periode.at(-1)!.rentang.akhir },
            daftarPeriode: periode,
        };
    });
    const awalTerlama = new Date(Math.min(now.getTime(), ...modul.map((m) => m.rentang.awal.getTime())));
    const akhirTerbaru = new Date(Math.max(now.getTime(), ...modul.map((m) => m.rentang.akhir.getTime())));
    const tipeIds = modul.map((m) => m.id);

    const [asetRows, insp] = await Promise.all([
        tipeIds.length
            ? db
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
                      areaId: assets.areaId,
                  })
                  .from(assets)
                  .leftJoin(areas, eq(areas.id, assets.areaId))
                  .where(and(eq(assets.aktif, true), inArray(assets.assetTypeId, tipeIds)))
                  .orderBy(asc(assets.kode))
            : [],
        db
            .select({ assetId: inspections.assetId, inspectedAt: inspections.inspectedAt, kesimpulan: inspections.kesimpulan })
            .from(inspections)
            .where(
                and(
                    eq(inspections.status, "final"),
                    gte(inspections.inspectedAt, awalTerlama),
                    lt(inspections.inspectedAt, akhirTerbaru),
                ),
            )
            .orderBy(desc(inspections.inspectedAt), desc(inspections.id)),
    ]);

    const perAset = Map.groupBy(insp, (i) => i.assetId);
    const modulPerId = new Map(modul.map((m) => [m.id, m]));
    const banyakPeriode = !!opsi.bulan;
    const aset: SlotProgres[] = [];
    const cek = new Map<number | string, CekTerakhir>();
    for (const a of asetRows) {
        const m = modulPerId.get(a.assetTypeId)!;
        for (const p of m.daftarPeriode) {
            const id = banyakPeriode ? `${a.id}@${p.periode}` : a.id;
            aset.push({
                id,
                asetId: a.id,
                periode: p.periode,
                kode: a.kode,
                modulSlug: m.slug,
                modul: m.nama,
                area: namaGedung(a.area, a.gedung),
                lokasi: lokasiTemuan({ lantai: a.lantai, lokasiTeks: a.lokasiTeks }),
                lat: a.lat,
                lng: a.lng,
                areaId: a.areaId,
            });
            // Daftar terurut terbaru dulu: inspeksi pertama di rentang = kesimpulan terakhir periode itu.
            const t = perAset
                .get(a.id)
                ?.find((i) => i.inspectedAt && i.inspectedAt >= p.rentang.awal && i.inspectedAt < p.rentang.akhir);
            if (t) cek.set(id, { kesimpulan: t.kesimpulan });
        }
    }
    return { modul, aset, cek, ...rakitProgres(modul, aset, cek) };
}

/** Progres periode berjalan untuk dasbor dan papan pantau (lihat `progres`). */
export function progresSemuaModul(now = new Date()) {
    return progres({}, now);
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
