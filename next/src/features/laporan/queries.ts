import "server-only";
import { and, asc, count, desc, eq, gte, inArray, lt, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  areas,
  assetTypes,
  assets,
  checklistGroups,
  checklistItems,
  divisions,
  inspectionAnswers,
  inspectionPhotos,
  inspections,
  issues,
  users,
} from "@/db/schema";
import type { Kesimpulan } from "@/lib/domain/constants";
import { syaratAntreanTinjauan } from "@/features/tinjauan/server";
import { tanggalIso } from "./format";
import { rakitPeriode, type AsetLaporan, type ButirLaporan, type InspeksiKartu, type TemuanLaporan } from "./rakit";

/** Batas bulan kalender WIB sebagai instan UTC: [awal, akhir). */
export function rentangBulan(tahun: number, bulan: number): { awal: Date; akhir: Date } {
  const WIB = 7 * 3_600_000;
  return { awal: new Date(Date.UTC(tahun, bulan - 1, 1) - WIB), akhir: new Date(Date.UTC(tahun, bulan, 1) - WIB) };
}

export function rentangTahun(tahun: number): { awal: Date; akhir: Date } {
  return { awal: rentangBulan(tahun, 1).awal, akhir: rentangBulan(tahun + 1, 1).awal };
}

export type FilterPeriode = { tipe: string; tahun: number; bulan: number; gedung: string | null };

export async function daftarTipe() {
  return db.select({ slug: assetTypes.slug, nama: assetTypes.nama }).from(assetTypes).orderBy(asc(assetTypes.urut));
}

export async function daftarGedung(): Promise<string[]> {
  const rows = await db.selectDistinct({ g: assets.gedung }).from(assets).where(sql`${assets.gedung} is not null`).orderBy(asc(assets.gedung));
  return rows.map((r) => r.g!).filter(Boolean);
}

/** Tahun yang punya inspeksi final, ditambah tahun ini (SPEC §4.9, ACCEPTANCE L6). */
export async function tahunTersedia(now = new Date()): Promise<number[]> {
  const rows = await db
    .selectDistinct({ th: sql<number>`extract(year from ${inspections.inspectedAt} at time zone 'Asia/Jakarta')::int` })
    .from(inspections)
    .where(and(eq(inspections.status, "final"), sql`${inspections.inspectedAt} is not null`));
  const set = new Set(rows.map((r) => r.th));
  set.add(Number(tanggalIso(now).slice(0, 4)));
  return [...set].sort((a, b) => b - a);
}

/** Semua bahan satu periode laporan (LaporanController::rakit). null bila tipe tidak dikenal. */
export async function ambilDataPeriode(f: FilterPeriode) {
  const [tipe] = await db.select().from(assetTypes).where(eq(assetTypes.slug, f.tipe)).limit(1);
  if (!tipe) return null;
  const { awal, akhir } = rentangBulan(f.tahun, f.bulan);

  const asetRows: AsetLaporan[] = await db
    .select({
      id: assets.id,
      kode: assets.kode,
      gedung: assets.gedung,
      lantai: assets.lantai,
      lokasiTeks: assets.lokasiTeks,
      aktif: assets.aktif,
      attributes: assets.attributes,
    })
    .from(assets)
    .where(and(eq(assets.assetTypeId, tipe.id), f.gedung ? eq(assets.gedung, f.gedung) : undefined));

  const butirRows: ButirLaporan[] = await db
    .select({
      id: checklistItems.id,
      label: checklistItems.label,
      dasarHukum: checklistItems.dasarHukum,
      grupNama: checklistGroups.nama,
      grupUrut: checklistGroups.urut,
      urut: checklistItems.urut,
      answerType: checklistItems.answerType,
      severityMap: checklistItems.severityMap,
      severityDefault: checklistItems.severityDefault,
      jumlahBaku: checklistItems.jumlahBaku,
      jumlahBakuPerTipe: checklistItems.jumlahBakuPerTipe,
      hasExpiry: checklistItems.hasExpiry,
    })
    .from(checklistItems)
    .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
    .where(and(eq(checklistGroups.assetTypeId, tipe.id), eq(checklistItems.aktif, true)));

  const idAset = asetRows.map((a) => a.id);
  const insRows = idAset.length
    ? await db
        .select({
          id: inspections.id,
          assetId: inspections.assetId,
          inspectedAt: inspections.inspectedAt,
          kesimpulan: inspections.kesimpulan,
          gateStatus: inspections.gateStatus,
          ditinjauPada: inspections.ditinjauPada,
          petugas: users.name,
        })
        .from(inspections)
        .innerJoin(users, eq(users.id, inspections.userId))
        .where(
          and(
            inArray(inspections.assetId, idAset),
            eq(inspections.status, "final"),
            gte(inspections.inspectedAt, awal),
            lt(inspections.inspectedAt, akhir),
          ),
        )
    : [];

  const jawaban = insRows.length
    ? await db
        .select({
          inspectionId: inspectionAnswers.inspectionId,
          checklistItemId: inspectionAnswers.checklistItemId,
          nilai: inspectionAnswers.nilai,
          nilaiAngka: inspectionAnswers.nilaiAngka,
          kondisiIsi: inspectionAnswers.kondisiIsi,
          tglKedaluwarsaTerdekat: inspectionAnswers.tglKedaluwarsaTerdekat,
        })
        .from(inspectionAnswers)
        .where(inArray(inspectionAnswers.inspectionId, insRows.map((i) => i.id)))
    : [];
  const jawabanPer = Map.groupBy(jawaban, (j) => j.inspectionId);

  const temuanRows: TemuanLaporan[] = idAset.length
    ? await db
        .select({
          id: issues.id,
          assetId: issues.assetId,
          item: issues.item,
          severity: issues.severity,
          status: issues.status,
          tindakLanjut: issues.tindakLanjut,
          targetSelesai: issues.targetSelesai,
          createdAt: issues.createdAt,
          selesaiPada: issues.selesaiPada,
          inspectionId: issues.inspectionId,
        })
        .from(issues)
        .where(and(inArray(issues.assetId, idAset), ne(issues.status, "selesai")))
    : [];

  const data = rakitPeriode({
    aset: asetRows,
    butir: butirRows,
    inspeksi: insRows.map((i) => ({ ...i, inspectedAt: i.inspectedAt!, jawaban: jawabanPer.get(i.id) ?? [] })),
    temuan: temuanRows,
    slug: tipe.slug,
  });
  return { tipe: { slug: tipe.slug, nama: tipe.nama }, filter: f, ...data };
}

export type DataPeriodeLengkap = NonNullable<Awaited<ReturnType<typeof ambilDataPeriode>>>;

/**
 * Foto bukti untuk lampiran rekap temuan (SPEC §9 #1: dulu tidak pernah tampil di laporan).
 * Diambil dari inspeksi yang melahirkan tiap temuan; paling banyak `perTemuan` foto per temuan.
 */
export async function fotoUntukTemuan(idTemuan: number[], perTemuan = 2) {
  type Baris = {
    id: string;
    storageKey: string;
    contentType: string;
    uploadedAt: Date;
    takenAtDevice: Date | null;
    gpsAccuracy: number | null;
    lat: number | null;
    lng: number | null;
    kode: string;
    gedung: string | null;
    area: string | null;
    inspektur: string;
  };
  if (!idTemuan.length) return new Map<number, Baris[]>();
  const rows = await db
    .select({
      issueId: issues.id,
      id: inspectionPhotos.id,
      storageKey: inspectionPhotos.storageKey,
      contentType: inspectionPhotos.contentType,
      uploadedAt: inspectionPhotos.uploadedAt,
      // Bahan cap foto (lapisan di PDF; JPEG tidak diubah).
      takenAtDevice: inspectionPhotos.takenAtDevice,
      gpsAccuracy: inspectionPhotos.gpsAccuracy,
      lat: inspectionPhotos.lat,
      lng: inspectionPhotos.lng,
      kode: assets.kode,
      gedung: assets.gedung,
      area: areas.nama,
      inspektur: users.name,
    })
    .from(issues)
    .innerJoin(inspectionPhotos, eq(inspectionPhotos.inspectionId, issues.inspectionId))
    .innerJoin(inspections, eq(inspections.id, issues.inspectionId))
    .innerJoin(assets, eq(assets.id, inspections.assetId))
    .innerJoin(users, eq(users.id, inspections.userId))
    .leftJoin(areas, eq(areas.id, assets.areaId))
    .where(inArray(issues.id, idTemuan))
    .orderBy(asc(inspectionPhotos.uploadedAt));
  const out = new Map<number, (typeof rows)[number][]>();
  for (const r of rows) {
    const list = out.get(r.issueId) ?? [];
    if (list.length < perTemuan) list.push(r);
    out.set(r.issueId, list);
  }
  return out;
}

/** Bahan kartu kontrol satu aset satu tahun. null bila aset tidak ada. */
export async function ambilKartu(assetId: number, tahun: number) {
  const [aset] = await db
    .select({
      id: assets.id,
      kode: assets.kode,
      gedung: assets.gedung,
      lantai: assets.lantai,
      lokasiTeks: assets.lokasiTeks,
      attributes: assets.attributes,
      tglExpired: assets.tglExpired,
      tipe: assetTypes.nama,
      slug: assetTypes.slug,
      divisi: divisions.nama,
    })
    .from(assets)
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .leftJoin(divisions, eq(divisions.id, assets.divisionId))
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!aset) return null;
  const { awal, akhir } = rentangTahun(tahun);
  const jumlahTemuan = db
    .select({ inspectionId: issues.inspectionId, n: count().as("n") })
    .from(issues)
    .groupBy(issues.inspectionId)
    .as("jt");
  const rows = await db
    .select({
      inspectedAt: inspections.inspectedAt,
      kesimpulan: inspections.kesimpulan,
      gateStatus: inspections.gateStatus,
      ditinjauPada: inspections.ditinjauPada,
      petugas: users.name,
      jumlahTemuan: sql<number>`coalesce(${jumlahTemuan.n}, 0)::int`,
    })
    .from(inspections)
    .innerJoin(users, eq(users.id, inspections.userId))
    .leftJoin(jumlahTemuan, eq(jumlahTemuan.inspectionId, inspections.id))
    .where(
      and(eq(inspections.assetId, assetId), eq(inspections.status, "final"), gte(inspections.inspectedAt, awal), lt(inspections.inspectedAt, akhir)),
    );
  const inspeksi: InspeksiKartu[] = rows.map((r) => ({ ...r, inspectedAt: r.inspectedAt! }));
  return { aset, inspeksi };
}

/** Daftar aset untuk pilihan kartu kontrol. */
export async function daftarAsetKartu(tipe: string, gedung: string | null) {
  return db
    .select({ id: assets.id, kode: assets.kode, gedung: assets.gedung, lantai: assets.lantai, lokasiTeks: assets.lokasiTeks })
    .from(assets)
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .where(and(eq(assetTypes.slug, tipe), eq(assets.aktif, true), gedung ? eq(assets.gedung, gedung) : undefined))
    .orderBy(asc(assets.kode));
}

/** Kondisi antrean tinjauan bersama Admin K3 dan Pemantau (features/tinjauan). */
export function antreanTinjauan(): SQL[] {
  return [syaratAntreanTinjauan!];
}

/* ------------------------------------------------------------------ */
/* Inspeksi dan temuan (lihat saja)                                     */
/* ------------------------------------------------------------------ */

export const TAB_INSPEKSI = ["antre", "menyimpang", "tidak_layak", "semua"] as const;
export type TabInspeksi = (typeof TAB_INSPEKSI)[number];
export const PER_HALAMAN = 25;

function kondisiTab(tab: TabInspeksi): SQL[] {
  switch (tab) {
    case "antre":
      return antreanTinjauan();
    case "menyimpang":
      return [eq(inspections.status, "final"), inArray(inspections.gateStatus, ["perlu_review", "jauh"])];
    case "tidak_layak":
      return [eq(inspections.status, "final"), eq(inspections.kesimpulan, "tidak_layak")];
    default:
      return [eq(inspections.status, "final")];
  }
}

export async function hitungTabInspeksi() {
  const out = {} as Record<TabInspeksi, number>;
  for (const tab of TAB_INSPEKSI) {
    const [r] = await db.select({ n: count() }).from(inspections).where(and(...kondisiTab(tab)));
    out[tab] = r?.n ?? 0;
  }
  return out;
}

export async function daftarInspeksi(tab: TabInspeksi, halaman: number) {
  return db
    .select({
      id: inspections.id,
      inspectedAt: inspections.inspectedAt,
      kode: assets.kode,
      gedung: assets.gedung,
      lantai: assets.lantai,
      lokasiTeks: assets.lokasiTeks,
      petugas: users.name,
      qrVerified: inspections.qrVerified,
      gateStatus: inspections.gateStatus,
      jarakM: inspections.jarakM,
      gpsAccuracy: inspections.gpsAccuracy,
      kesimpulan: inspections.kesimpulan,
      durasiDetik: inspections.durasiDetik,
      offline: inspections.offline,
      ditinjauPada: inspections.ditinjauPada,
      catatanReview: inspections.catatanReview,
      jumlahFoto: sql<number>`(select count(*)::int from ${inspectionPhotos} where ${inspectionPhotos.inspectionId} = ${inspections.id})`,
    })
    .from(inspections)
    .innerJoin(assets, eq(assets.id, inspections.assetId))
    .innerJoin(users, eq(users.id, inspections.userId))
    .where(and(...kondisiTab(tab)))
    .orderBy(tab === "antre" ? asc(inspections.inspectedAt) : desc(inspections.inspectedAt), asc(inspections.id))
    .limit(PER_HALAMAN)
    .offset((halaman - 1) * PER_HALAMAN);
}

export async function detailInspeksi(id: string) {
  const [row] = await db
    .select({
      ins: inspections,
      aset: {
        id: assets.id,
        kode: assets.kode,
        gedung: assets.gedung,
        lantai: assets.lantai,
        lokasiTeks: assets.lokasiTeks,
        lat: assets.lat,
        lng: assets.lng,
        attributes: assets.attributes,
      },
      area: { nama: areas.nama, polygon: areas.polygon },
      tipe: assetTypes.nama,
      petugas: users.name,
      nipPetugas: users.nip,
    })
    .from(inspections)
    .innerJoin(assets, eq(assets.id, inspections.assetId))
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .innerJoin(users, eq(users.id, inspections.userId))
    .leftJoin(areas, eq(areas.id, assets.areaId))
    .where(eq(inspections.id, id))
    .limit(1);
  if (!row) return null;
  const [peninjau] = row.ins.ditinjauOleh
    ? await db.select({ name: users.name }).from(users).where(eq(users.id, row.ins.ditinjauOleh))
    : [];
  const jawaban = await db
    .select({
      itemId: checklistItems.id,
      label: checklistItems.label,
      answerType: checklistItems.answerType,
      severityMap: checklistItems.severityMap,
      severityDefault: checklistItems.severityDefault,
      jumlahBaku: checklistItems.jumlahBaku,
      satuan: checklistItems.satuan,
      dasarHukum: checklistItems.dasarHukum,
      grup: checklistGroups.nama,
      grupUrut: checklistGroups.urut,
      urut: checklistItems.urut,
      nilai: inspectionAnswers.nilai,
      nilaiAngka: inspectionAnswers.nilaiAngka,
      catatan: inspectionAnswers.catatan,
    })
    .from(inspectionAnswers)
    .innerJoin(checklistItems, eq(checklistItems.id, inspectionAnswers.checklistItemId))
    .innerJoin(checklistGroups, eq(checklistGroups.id, checklistItems.checklistGroupId))
    .where(eq(inspectionAnswers.inspectionId, id))
    .orderBy(asc(checklistGroups.urut), asc(checklistItems.urut));
  const foto = await db
    .select({ id: inspectionPhotos.id, uploadedAt: inspectionPhotos.uploadedAt, takenAtDevice: inspectionPhotos.takenAtDevice, width: inspectionPhotos.width, height: inspectionPhotos.height, gpsAccuracy: inspectionPhotos.gpsAccuracy, lat: inspectionPhotos.lat, lng: inspectionPhotos.lng })
    .from(inspectionPhotos)
    .where(eq(inspectionPhotos.inspectionId, id))
    .orderBy(asc(inspectionPhotos.uploadedAt));
  const temuan = await db
    .select({ id: issues.id, item: issues.item, severity: issues.severity, tindakan: issues.tindakanRekomendasi })
    .from(issues)
    .where(eq(issues.inspectionId, id))
    .orderBy(asc(issues.id));
  return { ...row, peninjau: peninjau?.name ?? null, jawaban, foto, temuan };
}

export type { Kesimpulan };
