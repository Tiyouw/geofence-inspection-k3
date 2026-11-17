import "server-only";
import { and, asc, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { areas, assets, assetTypes, inspections, issues, users } from "@/db/schema";
import { progresSemuaModul, temuanSejak, trenEnamBulan } from "@/features/dasbor/server";
import { hitungTinjauan, syaratAntreanTinjauan } from "@/features/tinjauan/server";
import { lokasiTemuan } from "@/lib/domain/temuan";
import { PER_HALAMAN_ANTREAN, halamanAman, titikPeta, type TabAntrean } from "../lib/dasbor";
import { mundurBulan, periodeJakarta, sisaHariBulan } from "../lib/periode";

/** Antrean tinjauan bersama Admin K3 dan Pemantau (features/tinjauan). */
export { syaratAntreanTinjauan };

/** Waktu temuan = waktu resmi inspeksinya; data lama memakai created_at. */
const waktuTemuan = sql<Date>`coalesce(${inspections.inspectedAt}, ${issues.createdAt})`;

/**
 * Ringkasan dasbor admin lintas empat modul (PRD F14): progres per modul pada periodenya,
 * per gedung, kondisi, temuan bulan ini, antrean tinjauan, tren, dan peta aset bertitik.
 * Hanya membaca: membuka dasbor tidak pernah menulis jadwal (G11).
 */
export async function ringkasanDasbor(now = new Date()) {
    const p = periodeJakarta(now);
    const [progres, temuan, tinjauan, trenRows] = await Promise.all([
        progresSemuaModul(now),
        temuanSejak(p.awal),
        hitungTinjauan(p.awal),
        trenEnamBulan(mundurBulan(p, 5).awal, p.akhir),
    ]);
    const antre = await db
        .selectDistinct({ assetId: inspections.assetId })
        .from(inspections)
        .where(syaratAntreanTinjauan);
    const tinjau = new Set(antre.map((r) => r.assetId));

    const trenMap = new Map(trenRows.map((r) => [r.bulan, r.n]));
    const tren = Array.from({ length: 6 }, (_, i) => {
        const b = mundurBulan(p, 5 - i);
        const kunci = b.tanggal.slice(0, 7);
        return { kunci, periode: b, jumlah: trenMap.get(kunci) ?? 0 };
    });

    const peta = titikPeta(
        progres.aset
            .filter((a) => a.lat != null && a.lng != null)
            .map((a) => ({
                id: a.asetId,
                kode: a.kode,
                gedung: a.area,
                lantai: null,
                lokasiTeks: a.lokasi,
                lat: a.lat,
                lng: a.lng,
                sudahDiperiksa: progres.cek.has(a.id),
                kesimpulan: progres.cek.get(a.id)?.kesimpulan ?? null,
                tinjau: tinjau.has(a.asetId),
            })),
    );

    return {
        periode: p,
        total: progres.total,
        diperiksa: progres.sudah,
        persen: progres.persen,
        modul: progres.perModul,
        area: progres.perArea,
        kondisi: progres.kondisi,
        jumlah: { berat: temuan.berat, tinjauan: tinjauan.menunggu, belum: progres.belum },
        temuan,
        tinjauan,
        tren,
        peta,
        sisaHari: sisaHariBulan(now),
    };
}

export type BarisTemuanAntrean = {
    jenis: "temuan";
    id: number;
    item: string;
    waktu: Date;
    asetKode: string;
    modul: string;
    lokasi: string;
};
export type BarisTinjauanAntrean = {
    jenis: "tinjauan";
    id: string;
    inspectedAt: Date | null;
    gpsAccuracy: number | null;
    gateStatus: (typeof inspections.$inferSelect)["gateStatus"];
    gateAlasan: (typeof inspections.$inferSelect)["gateAlasan"];
    restrictedArea: boolean;
    asetKode: string;
    modul: string;
    lokasi: string;
    inspektur: string;
};
export type BarisBelumAntrean = { jenis: "belum"; id: number; asetKode: string; modul: string; lokasi: string };
export type BarisAntrean = BarisTemuanAntrean | BarisTinjauanAntrean | BarisBelumAntrean;

/** Isi satu tab antrean, 6 per halaman; halaman di luar rentang dikoreksi (I3, I4). */
export async function antreanDasbor(
    tab: TabAntrean,
    halamanDiminta: unknown,
    now = new Date(),
): Promise<{ baris: BarisAntrean[]; halaman: number; terakhir: number; total: number }> {
    const p = periodeJakarta(now);
    const per = PER_HALAMAN_ANTREAN;
    const kolomAset = {
        asetKode: assets.kode,
        modul: assetTypes.nama,
        area: areas.nama,
        gedung: assets.gedung,
        lantai: assets.lantai,
        lokasiTeks: assets.lokasiTeks,
    };
    const lokasi = (r: { area: string | null; gedung: string | null; lantai: string | null; lokasiTeks: string }) =>
        lokasiTemuan({ area: r.area, gedung: r.gedung, lantai: r.lantai, lokasiTeks: r.lokasiTeks });

    if (tab === "berat") {
        const syarat = and(eq(issues.severity, "berat"), gte(waktuTemuan, p.awal));
        const [{ n } = { n: 0 }] = await db
            .select({ n: count() })
            .from(issues)
            .leftJoin(inspections, eq(inspections.id, issues.inspectionId))
            .where(syarat);
        const { halaman, terakhir } = halamanAman(halamanDiminta, n, per);
        const rows = await db
            .select({ id: issues.id, item: issues.item, waktu: waktuTemuan, ...kolomAset })
            .from(issues)
            .innerJoin(assets, eq(assets.id, issues.assetId))
            .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
            .leftJoin(areas, eq(areas.id, assets.areaId))
            .leftJoin(inspections, eq(inspections.id, issues.inspectionId))
            .where(syarat)
            .orderBy(sql`${waktuTemuan} desc`, asc(issues.id))
            .limit(per)
            .offset((halaman - 1) * per);
        return {
            baris: rows.map((r) => ({
                jenis: "temuan" as const,
                id: r.id,
                item: r.item,
                waktu: new Date(r.waktu),
                asetKode: r.asetKode,
                modul: r.modul,
                lokasi: lokasi(r),
            })),
            halaman,
            terakhir,
            total: n,
        };
    }

    if (tab === "tinjauan") {
        const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(inspections).where(syaratAntreanTinjauan);
        const { halaman, terakhir } = halamanAman(halamanDiminta, n, per);
        const rows = await db
            .select({
                id: inspections.id,
                inspectedAt: inspections.inspectedAt,
                gpsAccuracy: inspections.gpsAccuracy,
                gateStatus: inspections.gateStatus,
                gateAlasan: inspections.gateAlasan,
                restrictedArea: inspections.restrictedArea,
                inspektur: users.name,
                ...kolomAset,
            })
            .from(inspections)
            .innerJoin(assets, eq(assets.id, inspections.assetId))
            .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
            .leftJoin(areas, eq(areas.id, assets.areaId))
            .innerJoin(users, eq(users.id, inspections.userId))
            .where(syaratAntreanTinjauan)
            .orderBy(asc(inspections.inspectedAt), asc(inspections.id))
            .limit(per)
            .offset((halaman - 1) * per);
        return {
            baris: rows.map(({ area, gedung, lantai, lokasiTeks, ...r }) => ({
                jenis: "tinjauan" as const,
                ...r,
                lokasi: lokasi({ area, gedung, lantai, lokasiTeks }),
            })),
            halaman,
            terakhir,
            total: n,
        };
    }

    // Belum dicek pada periode modulnya (bulan; minggu untuk mobil pemadam).
    const progres = await progresSemuaModul(now);
    const belum = progres.aset.filter((a) => !progres.cek.has(a.id));
    const { halaman, terakhir } = halamanAman(halamanDiminta, belum.length, per);
    return {
        baris: belum.slice((halaman - 1) * per, halaman * per).map((a) => ({
            jenis: "belum" as const,
            id: a.asetId,
            asetKode: a.kode,
            modul: a.modul,
            lokasi: [a.area, a.lokasi === "-" ? null : a.lokasi].filter(Boolean).join(" · ") || "-",
        })),
        halaman,
        terakhir,
        total: belum.length,
    };
}

/** Lencana menu Tinjauan = jumlah antrean (semua modul). */
export async function jumlahAntreanTinjauan(): Promise<number> {
    const [r] = await db.select({ n: count() }).from(inspections).where(syaratAntreanTinjauan);
    return r?.n ?? 0;
}
