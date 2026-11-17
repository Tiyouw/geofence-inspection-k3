import "server-only";
import { and, asc, count, countDistinct, desc, eq, gte, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  assetTypes,
  assets,
  checklistGroups,
  checklistItems,
  divisions,
  inspectionAnswers,
  inspectionPhotos,
  inspections,
  issueEvents,
  issues,
  users,
} from "@/db/schema";
import { GATE_PERLU_TINJAUAN, type Kesimpulan, type Severity, type IssueStatus } from "@/lib/domain/constants";
import { NAMA_BULAN, tanggalIso } from "./format";
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
  });
  return { tipe: { slug: tipe.slug, nama: tipe.nama }, filter: f, ...data };
}

export type DataPeriodeLengkap = NonNullable<Awaited<ReturnType<typeof ambilDataPeriode>>>;

/**
 * Foto bukti untuk lampiran rekap temuan (SPEC §9 #1: dulu tidak pernah tampil di laporan).
 * Diambil dari inspeksi yang melahirkan tiap temuan; paling banyak `perTemuan` foto per temuan.
 */
export async function fotoUntukTemuan(idTemuan: number[], perTemuan = 2) {
  if (!idTemuan.length) return new Map<number, { id: string; storageKey: string; contentType: string; uploadedAt: Date }[]>();
  const rows = await db
    .select({
      issueId: issues.id,
      id: inspectionPhotos.id,
      storageKey: inspectionPhotos.storageKey,
      contentType: inspectionPhotos.contentType,
      uploadedAt: inspectionPhotos.uploadedAt,
    })
    .from(issues)
    .innerJoin(inspectionPhotos, eq(inspectionPhotos.inspectionId, issues.inspectionId))
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

/* ------------------------------------------------------------------ */
/* Papan pantau (SPEC §5): angka hanya APAR aktif, bulan berjalan WIB. */
/* ------------------------------------------------------------------ */

const asetAparAktif = and(eq(assetTypes.slug, "apar"), eq(assets.aktif, true));

export async function ambilPapanPantau(now = new Date()) {
  const iso = tanggalIso(now);
  const tahun = Number(iso.slice(0, 4));
  const bulan = Number(iso.slice(5, 7));
  const { awal, akhir } = rentangBulan(tahun, bulan);

  const aset = await db
    .select({ id: assets.id, kode: assets.kode, gedung: assets.gedung, lantai: assets.lantai })
    .from(assets)
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .where(asetAparAktif);

  // Inspeksi final terakhir bulan ini per aset (kondisi = kesimpulan terbaru, ACCEPTANCE I1).
  const terakhir = await db
    .selectDistinctOn([inspections.assetId], { assetId: inspections.assetId, kesimpulan: inspections.kesimpulan })
    .from(inspections)
    .where(and(eq(inspections.status, "final"), gte(inspections.inspectedAt, awal), lt(inspections.inspectedAt, akhir)))
    .orderBy(inspections.assetId, desc(inspections.inspectedAt));
  const idAktif = new Set(aset.map((a) => a.id));
  const kondisiPer = new Map(terakhir.filter((t) => idAktif.has(t.assetId)).map((t) => [t.assetId, t.kesimpulan]));

  const temuanTerbuka = await db
    .select({
      id: issues.id,
      item: issues.item,
      severity: issues.severity,
      status: issues.status,
      targetSelesai: issues.targetSelesai,
      kode: assets.kode,
      gedung: assets.gedung,
      lantai: assets.lantai,
      lokasiTeks: assets.lokasiTeks,
    })
    .from(issues)
    .innerJoin(assets, eq(assets.id, issues.assetId))
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .where(and(eq(assetTypes.slug, "apar"), ne(issues.status, "selesai")));

  const [posisi] = await db
    .select({ n: count() })
    .from(inspections)
    .innerJoin(assets, eq(assets.id, inspections.assetId))
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .where(and(eq(assetTypes.slug, "apar"), ...antreanTinjauan()));

  // Tren 6 bulan: aset unik yang diinspeksi per bulan (ACCEPTANCE I7).
  const tren: { label: string; jumlah: number }[] = [];
  for (let off = 5; off >= 0; off--) {
    const d = new Date(Date.UTC(tahun, bulan - 1 - off, 1));
    const r = rentangBulan(d.getUTCFullYear(), d.getUTCMonth() + 1);
    const [row] = await db
      .select({ n: countDistinct(inspections.assetId) })
      .from(inspections)
      .innerJoin(assets, eq(assets.id, inspections.assetId))
      .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
      .where(and(asetAparAktif, eq(inspections.status, "final"), gte(inspections.inspectedAt, r.awal), lt(inspections.inspectedAt, r.akhir)));
    tren.push({ label: NAMA_BULAN[d.getUTCMonth()]!.slice(0, 3), jumlah: row?.n ?? 0 });
  }

  return { periode: { tahun, bulan }, aset, kondisiPer, temuanTerbuka, posisi: posisi?.n ?? 0, tren, hariIni: iso };
}

/** Kondisi antrean tinjauan (SPEC §3.5). */
export function antreanTinjauan(): SQL[] {
  return [
    eq(inspections.status, "final"),
    or(inArray(inspections.gateStatus, GATE_PERLU_TINJAUAN), eq(inspections.restrictedArea, true))!,
    isNull(inspections.ditinjauPada),
  ];
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
        lokasiTipe: assets.lokasiTipe,
        radiusM: assets.radiusM,
        attributes: assets.attributes,
      },
      tipe: assetTypes.nama,
      petugas: users.name,
      nipPetugas: users.nip,
    })
    .from(inspections)
    .innerJoin(assets, eq(assets.id, inspections.assetId))
    .innerJoin(assetTypes, eq(assetTypes.id, assets.assetTypeId))
    .innerJoin(users, eq(users.id, inspections.userId))
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
    .select({ id: inspectionPhotos.id, uploadedAt: inspectionPhotos.uploadedAt, takenAtDevice: inspectionPhotos.takenAtDevice, width: inspectionPhotos.width, height: inspectionPhotos.height })
    .from(inspectionPhotos)
    .where(eq(inspectionPhotos.inspectionId, id))
    .orderBy(asc(inspectionPhotos.uploadedAt));
  const temuan = await db
    .select({ id: issues.id, item: issues.item, severity: issues.severity, status: issues.status, targetSelesai: issues.targetSelesai })
    .from(issues)
    .where(eq(issues.inspectionId, id))
    .orderBy(asc(issues.id));
  return { ...row, peninjau: peninjau?.name ?? null, jawaban, foto, temuan };
}

export const STATUS_FILTER = ["belum_selesai", "terbuka", "proses", "selesai", "semua"] as const;
export type FilterStatusTemuan = (typeof STATUS_FILTER)[number];

export async function daftarTemuan(f: { status: FilterStatusTemuan; tingkat: Severity | null; lewat: boolean; halaman: number }, hariIni: string) {
  const kondisi: (SQL | undefined)[] = [
    f.status === "belum_selesai" ? ne(issues.status, "selesai") : f.status === "semua" ? undefined : eq(issues.status, f.status as IssueStatus),
    f.tingkat ? eq(issues.severity, f.tingkat) : undefined,
    f.lewat ? and(ne(issues.status, "selesai"), lt(issues.targetSelesai, hariIni)) : undefined,
  ];
  const where = and(...kondisi);
  const [total] = await db.select({ n: count() }).from(issues).where(where);
  const rows = await db
    .select({
      id: issues.id,
      item: issues.item,
      severity: issues.severity,
      status: issues.status,
      tindakLanjut: issues.tindakLanjut,
      targetSelesai: issues.targetSelesai,
      selesaiPada: issues.selesaiPada,
      createdAt: issues.createdAt,
      inspectionId: issues.inspectionId,
      kode: assets.kode,
      gedung: assets.gedung,
      lantai: assets.lantai,
      lokasiTeks: assets.lokasiTeks,
      pic: users.name,
    })
    .from(issues)
    .innerJoin(assets, eq(assets.id, issues.assetId))
    .leftJoin(users, eq(users.id, issues.picUserId))
    .where(where)
    .orderBy(sql`case ${issues.severity} when 'berat' then 0 when 'sedang' then 1 else 2 end`, asc(issues.createdAt), asc(issues.id))
    .limit(PER_HALAMAN)
    .offset((f.halaman - 1) * PER_HALAMAN);
  return { total: total?.n ?? 0, rows };
}

/** Jejak tindak lanjut (issue_events) untuk temuan pada halaman ini. */
export async function jejakTemuan(idTemuan: number[]) {
  if (!idTemuan.length) return new Map<number, { aksi: string; ke: unknown; createdAt: Date; oleh: string | null }[]>();
  const rows = await db
    .select({ issueId: issueEvents.issueId, aksi: issueEvents.aksi, ke: issueEvents.ke, createdAt: issueEvents.createdAt, oleh: users.name })
    .from(issueEvents)
    .leftJoin(users, eq(users.id, issueEvents.userId))
    .where(inArray(issueEvents.issueId, idTemuan))
    .orderBy(asc(issueEvents.createdAt));
  return Map.groupBy(rows, (r) => r.issueId);
}

export type { Kesimpulan };
