import "server-only";
import { and, asc, count, eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { assets, assetTypes, divisions } from "@/db/schema";
import { LOKASI_TIPE, type LokasiTipe } from "@/lib/domain/constants";
import { hariIniJakarta } from "@/lib/format";
import { polaMengandung } from "../lib/pencarian";

export type FilterAset = {
  q?: string;
  tipe?: string;
  gedung?: string;
  lokasiTipe?: LokasiTipe;
  aktif?: "ya" | "tidak";
  tanpaKoordinat?: boolean;
  jatuhTempo?: boolean;
};

const satu = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

export function parseFilterAset(sp: Record<string, string | string[] | undefined>): FilterAset {
  const lokasi = satu(sp.lokasi);
  const aktif = satu(sp.aktif);
  return {
    q: satu(sp.q),
    tipe: satu(sp.tipe),
    gedung: satu(sp.gedung),
    lokasiTipe: lokasi && (LOKASI_TIPE as readonly string[]).includes(lokasi) ? (lokasi as LokasiTipe) : undefined,
    aktif: aktif === "ya" || aktif === "tidak" ? aktif : undefined,
    tanpaKoordinat: sp.tanpa_koordinat === "1",
    jatuhTempo: sp.jatuh_tempo === "1",
  };
}

/** Setiap filter berdiri sendiri dan digabung AND, jadi "tanpa koordinat" tetap menghormati filter lain (H3). */
function syaratAset(f: FilterAset, hariIni: string): SQL | undefined {
  const s: (SQL | undefined)[] = [];
  if (f.q) {
    const pola = polaMengandung(f.q);
    s.push(
      or(
        sql`${assets.kode} ilike ${pola} escape '!'`,
        sql`${assets.lokasiTeks} ilike ${pola} escape '!'`,
        sql`coalesce(${assets.gedung}, '') ilike ${pola} escape '!'`,
      ),
    );
  }
  if (f.tipe) s.push(eq(assetTypes.slug, f.tipe));
  if (f.gedung) s.push(eq(assets.gedung, f.gedung));
  if (f.lokasiTipe) s.push(eq(assets.lokasiTipe, f.lokasiTipe));
  if (f.aktif) s.push(eq(assets.aktif, f.aktif === "ya"));
  if (f.tanpaKoordinat) s.push(or(isNull(assets.lat), isNull(assets.lng)));
  // Celah #7: memakai periode_hari tipe objek, bukan 30 hari tetap.
  if (f.jatuhTempo) {
    s.push(
      or(
        isNull(assets.terakhirDicek),
        sql`${assets.terakhirDicek} + ${assetTypes.periodeHari}::int < ${hariIni}::date`,
      ),
    );
  }
  return and(...s);
}

export const PER_HALAMAN_ASET = 50;

export async function daftarAset(f: FilterAset, halaman = 1) {
  const syarat = syaratAset(f, hariIniJakarta());
  const dasar = db
    .select({
      id: assets.id,
      kode: assets.kode,
      tipe: assetTypes.nama,
      gedung: assets.gedung,
      lantai: assets.lantai,
      lokasiTeks: assets.lokasiTeks,
      lokasiTipe: assets.lokasiTipe,
      radiusM: assets.radiusM,
      lat: assets.lat,
      lng: assets.lng,
      divisi: divisions.nama,
      terakhirDicek: assets.terakhirDicek,
      aktif: assets.aktif,
      isMobile: assetTypes.isMobile,
    })
    .from(assets)
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .leftJoin(divisions, eq(divisions.id, assets.divisionId))
    .where(syarat);
  const [rows, [jumlah]] = await Promise.all([
    dasar
      .orderBy(asc(assets.gedung), asc(assets.lantai), asc(assets.kode))
      .limit(PER_HALAMAN_ASET)
      .offset((halaman - 1) * PER_HALAMAN_ASET),
    db
      .select({ n: count() })
      .from(assets)
      .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
      .where(syarat),
  ]);
  return { rows, total: jumlah?.n ?? 0 };
}


/** Aset untuk formulir ubah. qr_token sengaja tidak dipilih. */
export async function ambilAset(id: number) {
  const [a] = await db
    .select({
      id: assets.id,
      assetTypeId: assets.assetTypeId,
      divisionId: assets.divisionId,
      kode: assets.kode,
      gedung: assets.gedung,
      lantai: assets.lantai,
      lokasiTeks: assets.lokasiTeks,
      lokasiTipe: assets.lokasiTipe,
      lat: assets.lat,
      lng: assets.lng,
      radiusM: assets.radiusM,
      attributes: assets.attributes,
      tglExpired: assets.tglExpired,
      terakhirDicek: assets.terakhirDicek,
      aktif: assets.aktif,
      qrTokenRotatedAt: assets.qrTokenRotatedAt,
      createdAt: assets.createdAt,
    })
    .from(assets)
    .where(eq(assets.id, id));
  return a ?? null;
}

export async function pilihanAset() {
  const [tipe, divisi, gedung] = await Promise.all([
    db.select({ id: assetTypes.id, slug: assetTypes.slug, nama: assetTypes.nama, isMobile: assetTypes.isMobile }).from(assetTypes).orderBy(asc(assetTypes.urut)),
    db.select({ id: divisions.id, nama: divisions.nama }).from(divisions).where(eq(divisions.aktif, true)).orderBy(asc(divisions.nama)),
    daftarGedung(),
  ]);
  return { tipe, divisi, gedung };
}

export async function daftarGedung(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ g: assets.gedung })
    .from(assets)
    .where(sql`${assets.gedung} is not null and ${assets.gedung} <> ''`)
    .orderBy(asc(assets.gedung));
  return rows.map((r) => r.g!);
}

/** Semua aset bertitik untuk peta lokasi (tanpa token). */
export async function asetUntukPeta(f: { gedung?: string; tipe?: string }) {
  return db
    .select({
      id: assets.id,
      kode: assets.kode,
      gedung: assets.gedung,
      lantai: assets.lantai,
      lokasiTeks: assets.lokasiTeks,
      lokasiTipe: assets.lokasiTipe,
      radiusM: assets.radiusM,
      lat: assets.lat,
      lng: assets.lng,
      aktif: assets.aktif,
      tipe: assetTypes.nama,
    })
    .from(assets)
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .where(and(f.gedung ? eq(assets.gedung, f.gedung) : undefined, f.tipe ? eq(assetTypes.slug, f.tipe) : undefined))
    .orderBy(asc(assets.gedung), asc(assets.lantai), asc(assets.kode));
}

