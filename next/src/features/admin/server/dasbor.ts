import "server-only";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, ne, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetTypes, inspections, issues, users } from "@/db/schema";
import { GATE_PERLU_TINJAUAN, KESIMPULAN, type Kesimpulan } from "@/lib/domain/constants";
import { namaArea } from "@/lib/domain/label-aset";
import { hariIniJakarta } from "@/lib/format";
import { PER_HALAMAN_ANTREAN, halamanAman, persen, titikPeta, type TabAntrean } from "../lib/dasbor";
import { mundurBulan, periodeJakarta, sisaHariBulan, type Periode } from "../lib/periode";

/**
 * Ringkasan dasbor admin (RingkasanDasbor.php). Semua angka hanya APAR (SPEC §4.7).
 * Hanya membaca: membuka dasbor tidak pernah menulis jadwal (G11).
 */
const tipeApar = sql`(select ${assetTypes.id} from ${assetTypes} where ${assetTypes.slug} = 'apar')`;
const asetApar = eq(assets.assetTypeId, tipeApar);
const asetAparAktif = and(eq(assets.aktif, true), asetApar);

/** Antrean tinjauan: final ∧ gerbang menyimpang ∧ belum ditinjau (E7). */
export const syaratAntreanTinjauan = and(
  eq(inspections.status, "final"),
  inArray(inspections.gateStatus, GATE_PERLU_TINJAUAN),
  isNull(inspections.ditinjauPada),
);

const finalDalam = (p: Periode) =>
  and(eq(inspections.status, "final"), gte(inspections.inspectedAt, p.awal), lt(inspections.inspectedAt, p.akhir));

const temuanBelumSelesai = and(ne(issues.status, "selesai"), asetApar);

export async function ringkasanDasbor(now = new Date()) {
  const p = periodeJakarta(now);
  const hariIni = hariIniJakarta(now);

  const [daftarAset, terakhir, antreAset, [berat], [lewat], [posisi], trenRows] = await Promise.all([
    db
      .select({
        id: assets.id,
        kode: assets.kode,
        gedung: assets.gedung,
        lantai: assets.lantai,
        lokasiTeks: assets.lokasiTeks,
        lat: assets.lat,
        lng: assets.lng,
      })
      .from(assets)
      .where(asetAparAktif)
      .orderBy(asc(assets.kode)),
    // Inspeksi final TERAKHIR per aset bulan ini.
    db
      .selectDistinctOn([inspections.assetId], { assetId: inspections.assetId, kesimpulan: inspections.kesimpulan })
      .from(inspections)
      .where(finalDalam(p))
      .orderBy(inspections.assetId, desc(inspections.inspectedAt), desc(inspections.id)),
    db
      .selectDistinct({ assetId: inspections.assetId })
      .from(inspections)
      .innerJoin(assets, eq(assets.id, inspections.assetId))
      .where(and(syaratAntreanTinjauan, asetApar)),
    db.select({ n: count() }).from(issues).innerJoin(assets, eq(assets.id, issues.assetId)).where(and(temuanBelumSelesai, eq(issues.severity, "berat"))),
    db.select({ n: count() }).from(issues).innerJoin(assets, eq(assets.id, issues.assetId)).where(and(temuanBelumSelesai, lt(issues.targetSelesai, hariIni))),
    db.select({ n: count() }).from(inspections).innerJoin(assets, eq(assets.id, inspections.assetId)).where(and(syaratAntreanTinjauan, asetApar)),
    db
      .select({
        bulan: sql<string>`to_char(${inspections.inspectedAt} at time zone 'Asia/Jakarta', 'YYYY-MM')`,
        n: sql<number>`count(distinct ${inspections.assetId})::int`,
      })
      .from(inspections)
      .innerJoin(assets, eq(assets.id, inspections.assetId))
      .where(and(asetAparAktif, eq(inspections.status, "final"), gte(inspections.inspectedAt, mundurBulan(p, 5).awal), lt(inspections.inspectedAt, p.akhir)))
      .groupBy(sql`1`),
  ]);

  const kesimpulanAset = new Map(terakhir.map((r) => [r.assetId, r.kesimpulan]));
  const tinjau = new Set(antreAset.map((r) => r.assetId));
  const total = daftarAset.length;
  const diperiksa = daftarAset.filter((a) => kesimpulanAset.has(a.id)).length;

  const kondisi = Object.fromEntries(KESIMPULAN.map((k) => [k, 0])) as Record<Kesimpulan, number>;
  for (const a of daftarAset) {
    const k = kesimpulanAset.get(a.id);
    if (k) kondisi[k]++;
  }

  const area = new Map<string, { total: number; sudah: number }>();
  for (const a of daftarAset) {
    const nama = namaArea(a);
    const v = area.get(nama) ?? { total: 0, sudah: 0 };
    v.total++;
    if (kesimpulanAset.has(a.id)) v.sudah++;
    area.set(nama, v);
  }

  const trenMap = new Map(trenRows.map((r) => [r.bulan, r.n]));
  const tren = Array.from({ length: 6 }, (_, i) => {
    const b = mundurBulan(p, 5 - i);
    const kunci = b.tanggal.slice(0, 7);
    return { kunci, periode: b, jumlah: trenMap.get(kunci) ?? 0 };
  });

  const peta = titikPeta(
    daftarAset.map((a) => ({
      ...a,
      sudahDiperiksa: kesimpulanAset.has(a.id),
      kesimpulan: kesimpulanAset.get(a.id) ?? null,
      tinjau: tinjau.has(a.id),
    })),
  );

  return {
    periode: p,
    total,
    diperiksa,
    persen: persen(diperiksa, total),
    jumlah: { berat: berat?.n ?? 0, lewat: lewat?.n ?? 0, posisi: posisi?.n ?? 0, belum: total - diperiksa },
    kondisi,
    tren,
    area: [...area.entries()].map(([nama, v]) => ({ nama, ...v })).sort((a, b) => a.nama.localeCompare(b.nama, "id")),
    peta,
    sisaHari: sisaHariBulan(now),
  };
}

export type BarisTemuanAntrean = {
  jenis: "temuan";
  id: number;
  item: string;
  severity: string;
  targetSelesai: string | null;
  createdAt: Date;
  asetKode: string;
  asetLokasi: string;
  asetGedung: string | null;
  asetLantai: string | null;
};
export type BarisPosisiAntrean = {
  jenis: "posisi";
  id: string;
  inspectedAt: Date | null;
  jarakM: number | null;
  gpsAccuracy: number | null;
  gateStatus: string;
  asetKode: string;
  asetLokasi: string;
  asetGedung: string | null;
  asetLantai: string | null;
  inspektur: string;
};
export type BarisBelumAntrean = {
  jenis: "belum";
  id: number;
  asetKode: string;
  asetLokasi: string;
  asetGedung: string | null;
  asetLantai: string | null;
};
export type BarisAntrean = BarisTemuanAntrean | BarisPosisiAntrean | BarisBelumAntrean;

/** Isi satu tab antrean, 6 per halaman; halaman di luar rentang dikoreksi (I3, I4). */
export async function antreanDasbor(
  tab: TabAntrean,
  halamanDiminta: unknown,
  now = new Date(),
): Promise<{ baris: BarisAntrean[]; halaman: number; terakhir: number; total: number }> {
  const hariIni = hariIniJakarta(now);
  const p = periodeJakarta(now);
  const per = PER_HALAMAN_ANTREAN;
  const kolomAset = { asetKode: assets.kode, asetLokasi: assets.lokasiTeks, asetGedung: assets.gedung, asetLantai: assets.lantai };

  if (tab === "berat" || tab === "lewat") {
    const syarat =
      tab === "berat"
        ? and(temuanBelumSelesai, eq(issues.severity, "berat"))
        : and(temuanBelumSelesai, lt(issues.targetSelesai, hariIni));
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(issues).innerJoin(assets, eq(assets.id, issues.assetId)).where(syarat);
    const { halaman, terakhir } = halamanAman(halamanDiminta, n, per);
    const rows = await db
      .select({ id: issues.id, item: issues.item, severity: issues.severity, targetSelesai: issues.targetSelesai, createdAt: issues.createdAt, ...kolomAset })
      .from(issues)
      .innerJoin(assets, eq(assets.id, issues.assetId))
      .where(syarat)
      .orderBy(...(tab === "berat" ? [asc(issues.createdAt), asc(issues.id)] : [asc(issues.targetSelesai), asc(issues.id)]))
      .limit(per)
      .offset((halaman - 1) * per);
    return { baris: rows.map((r) => ({ jenis: "temuan" as const, ...r })), halaman, terakhir, total: n };
  }

  if (tab === "posisi") {
    const syarat = and(syaratAntreanTinjauan, asetApar);
    const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(inspections).innerJoin(assets, eq(assets.id, inspections.assetId)).where(syarat);
    const { halaman, terakhir } = halamanAman(halamanDiminta, n, per);
    const rows = await db
      .select({
        id: inspections.id,
        inspectedAt: inspections.inspectedAt,
        jarakM: inspections.jarakM,
        gpsAccuracy: inspections.gpsAccuracy,
        gateStatus: inspections.gateStatus,
        inspektur: users.name,
        ...kolomAset,
      })
      .from(inspections)
      .innerJoin(assets, eq(assets.id, inspections.assetId))
      .innerJoin(users, eq(users.id, inspections.userId))
      .where(syarat)
      .orderBy(asc(inspections.inspectedAt), asc(inspections.id))
      .limit(per)
      .offset((halaman - 1) * per);
    return { baris: rows.map((r) => ({ jenis: "posisi" as const, ...r })), halaman, terakhir, total: n };
  }

  const belum = and(
    asetAparAktif,
    notExists(
      db
        .select({ x: sql`1` })
        .from(inspections)
        .where(and(eq(inspections.assetId, assets.id), finalDalam(p))),
    ),
  );
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(assets).where(belum);
  const { halaman, terakhir } = halamanAman(halamanDiminta, n, per);
  const rows = await db
    .select({ id: assets.id, ...kolomAset })
    .from(assets)
    .where(belum)
    .orderBy(asc(assets.kode))
    .limit(per)
    .offset((halaman - 1) * per);
  return { baris: rows.map((r) => ({ jenis: "belum" as const, ...r })), halaman, terakhir, total: n };
}

/** Lencana menu Tinjauan = jumlah antrean (semua tipe aset). */
export async function jumlahAntreanTinjauan(): Promise<number> {
  const [r] = await db.select({ n: count() }).from(inspections).where(syaratAntreanTinjauan);
  return r?.n ?? 0;
}
