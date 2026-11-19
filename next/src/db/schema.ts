/**
 * Skema domain PAL-K3 v2, mengikuti docs/v2/SPEC.md §2.3 (usulan skema Postgres).
 *
 * - Enum Postgres asli untuk nilai tertutup (SPEC §9 celah #10).
 * - UUID untuk entitas yang bisa lahir di perangkat (inspeksi, jawaban, foto) supaya
 *   antrean luring tidak butuh id dari peladen (SPEC §7).
 * - Token QR tetap di `assets.qr_token` (stiker tertempel harus tetap jalan saat migrasi).
 * - Foto di Vercel Blob PRIVAT; basis data hanya menyimpan `storage_key` (SPEC §3.6, §9 #1-2).
 * - `issue_events` = jejak tindak lanjut temuan; `audit_logs` = jejak aksi lain (SPEC §9 #16).
 *
 * Nama kolom di basis data snake_case (opsi `casing` di drizzle.config.ts dan src/db/index.ts).
 */
import { relations, sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  ANSWER_TYPES,
  AREA_JENIS,
  GATE_ALASAN,
  GATE_STATUSES,
  HASIL_TINJAUAN,
  INSPECTION_STATUSES,
  ISSUE_STATUSES,
  KESIMPULAN,
  KONDISI_ISI,
  LOKASI_TIPE,
  ROLES,
  SCHEDULE_STATUSES,
  SEVERITIES,
  TINDAKAN_REKOMENDASI,
  type Severity,
  type TipeKotakP3k,
} from "@/lib/domain/constants";

export const roleEnum = pgEnum("role", ROLES);
export const lokasiTipeEnum = pgEnum("lokasi_tipe", LOKASI_TIPE);
export const answerTypeEnum = pgEnum("answer_type", ANSWER_TYPES);
export const severityEnum = pgEnum("severity", SEVERITIES);
export const inspectionStatusEnum = pgEnum("inspection_status", INSPECTION_STATUSES);
export const gateStatusEnum = pgEnum("gate_status", GATE_STATUSES);
export const kesimpulanEnum = pgEnum("kesimpulan", KESIMPULAN);
export const issueStatusEnum = pgEnum("issue_status", ISSUE_STATUSES);
export const scheduleStatusEnum = pgEnum("schedule_status", SCHEDULE_STATUSES);
export const areaJenisEnum = pgEnum("area_jenis", AREA_JENIS);
export const gateAlasanEnum = pgEnum("gate_alasan", GATE_ALASAN);
export const hasilTinjauanEnum = pgEnum("hasil_tinjauan", HASIL_TINJAUAN);
export const kondisiIsiEnum = pgEnum("kondisi_isi", KONDISI_ISI);
export const tindakanRekomendasiEnum = pgEnum("tindakan_rekomendasi", TINDAKAN_REKOMENDASI);

/** Geometri GeoJSON (WGS84, [lng, lat]) untuk poligon area. */
export type GeoJsonPolygon =
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] };

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const tstz = () => timestamp({ withTimezone: true });
const createdAt = () => tstz().notNull().defaultNow();
const updatedAt = () =>
  tstz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const ts = () => ({ createdAt: createdAt(), updatedAt: updatedAt() });
/** decimal(10,7) seperti Laravel; dibaca sebagai number. */
const coord = () => numeric({ precision: 10, scale: 7, mode: "number" });

export const divisions = pgTable("divisions", {
  id: id(),
  nama: text().notNull(),
  kode: varchar({ length: 16 }).unique(),
  aktif: boolean().notNull().default(true),
  ...ts(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    /** Identitas masuk: NIP, atau username untuk akun demo. */
    nip: varchar({ length: 32 }).notNull().unique(),
    name: text().notNull(),
    /** Disimpan, tidak dipakai untuk masuk. */
    email: text().unique(),
    /** Selalu hash bcrypt, termasuk akun demo (SPEC §1.3). */
    passwordHash: text().notNull(),
    role: roleEnum().notNull().default("inspektur"),
    jabatan: text(),
    divisionId: integer().references(() => divisions.id, { onDelete: "set null" }),
    /** Petugas tidak pernah dihapus, hanya dinonaktifkan (SPEC §1.1). */
    aktif: boolean().notNull().default(true),
    isDemo: boolean().notNull().default(false),
    /**
     * Naik setiap sandi diganti, peran diubah, atau akun dinonaktifkan. Token sesi menyimpan
     * nilai saat masuk; getCurrentUser menolak token yang versinya lebih lama (audit 19 Nov 2026, S18).
     */
    sesiVersi: integer().notNull().default(0),
    lastLoginAt: tstz(),
    ...ts(),
  },
  (t) => [index().on(t.role, t.aktif)],
);

export const assetTypes = pgTable("asset_types", {
  id: id(),
  /** v2: apar, p3k, hydrant_pilar, hydrant_box, mobil_pemadam (ASSET_TYPE_SLUGS). Lama: hydrant, damkar. */
  slug: varchar({ length: 32 }).notNull().unique(),
  nama: text().notNull(),
  /** Unit kerja pemilik modul: hanya inspektur unit ini yang membuka asetnya (PRD F2, ADR-5). */
  ownerDivisionId: integer().references(() => divisions.id, { onDelete: "set null" }),
  /** Objek bergerak (mobil pemadam): gerbang GPS tidak diberlakukan. */
  isMobile: boolean().notNull().default(false),
  periodeHari: smallint().notNull().default(30),
  urut: smallint().notNull().default(0),
  aktif: boolean().notNull().default(true),
  ...ts(),
});

/**
 * Area: kawasan galangan (satu, `jenis = kawasan`) dan gedung/bengkel/dok/dermaga di dalamnya.
 * `polygon` = poligon yang dipakai gerbang (disetujui). `polygon_draf` = hasil impor GeoJSON atau
 * suntingan yang belum disetujui (PRD "Impor denah", ADR-10). Keduanya kosong sampai digambar.
 */
export const areas = pgTable(
  "areas",
  {
    id: id(),
    kode: varchar({ length: 32 }).notNull().unique(),
    nama: text().notNull(),
    jenis: areaJenisEnum().notNull().default("gedung"),
    polygon: jsonb().$type<GeoJsonPolygon>(),
    polygonDraf: jsonb().$type<GeoJsonPolygon>(),
    poligonDisetujuiPada: tstz(),
    poligonDisetujuiOleh: integer().references(() => users.id, { onDelete: "set null" }),
    /** Area terbatas (mis. Divisi Kapal Selam): kamera terpandu dilewati, inspeksi masuk antrean tinjauan. */
    restricted: boolean().notNull().default(false),
    /** Gedung/bengkel menunjuk kawasan; null untuk kawasan. */
    parentId: integer().references((): AnyPgColumn => areas.id, { onDelete: "set null" }),
    /** Unit kerja penanggung jawab area (opsional, informasi). */
    divisionId: integer().references(() => divisions.id, { onDelete: "set null" }),
    aktif: boolean().notNull().default(true),
    ...ts(),
  },
  (t) => [index().on(t.jenis, t.aktif), index().on(t.parentId)],
);

export const assets = pgTable(
  "assets",
  {
    id: id(),
    assetTypeId: integer()
      .notNull()
      .references(() => assetTypes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    divisionId: integer().references(() => divisions.id, { onDelete: "set null" }),
    /** Nomor aset, mis. 01D. */
    kode: varchar({ length: 32 }).notNull(),
    /** Teks lama; diganti `area_id` (dibiarkan sampai semua aset punya area). */
    gedung: varchar({ length: 64 }),
    areaId: integer().references(() => areas.id, { onDelete: "set null" }),
    /** "Lt. 1"; "-" atau kosong untuk area tanpa lantai (lihat labelLantai). */
    lantai: varchar({ length: 16 }),
    /** Keterangan titik, mis. "Lorong Timur titik 1". */
    lokasiTeks: text().notNull(),
    lokasiTipe: lokasiTipeEnum().notNull().default("dalam_gedung"),
    lat: coord(),
    lng: coord(),
    /** Override radius gerbang GPS, 5..500 m; null = ikut jenis lokasi (SPEC §3.5). */
    radiusM: smallint(),
    /**
     * Token stiker: acak, bukan nomor aset, tidak pernah ada di repo/seed (SPEC §3.1).
     * Hanya admin yang boleh melihatnya (lembar stiker), tidak pernah keluar lewat pencarian/peta.
     */
    qrToken: varchar({ length: 64 }).notNull().unique(),
    qrTokenRotatedAt: tstz(),
    /** {tipe, jenis, kapasitas_kg, ...} */
    attributes: jsonb().$type<AsetAtribut>(),
    tglExpired: date({ mode: "string" }),
    terakhirDicek: date({ mode: "string" }),
    aktif: boolean().notNull().default(true),
    ...ts(),
  },
  (t) => [
    uniqueIndex().on(t.assetTypeId, t.kode),
    index().on(t.assetTypeId, t.aktif),
    index().on(t.gedung),
    index().on(t.areaId),
  ],
);

/** Atribut aset per tipe (PRD "Checklist per modul"). */
export type AsetAtribut = {
  /** APAR */
  tipe?: string;
  jenis?: string;
  kapasitas_kg?: number;
  /** Kotak P3K: tipe kotak menentukan jumlah baku. */
  tipe_kotak?: TipeKotakP3k;
  /** Mobil pemadam */
  nomor_lambung?: string;
  nopol?: string;
  kapasitas_tangki_l?: number;
  kapasitas_pompa_lpm?: number;
} & Record<string, unknown>;

export const checklistGroups = pgTable(
  "checklist_groups",
  {
    id: id(),
    assetTypeId: integer()
      .notNull()
      .references(() => assetTypes.id, { onDelete: "cascade" }),
    /** A, B, C, D */
    kode: varchar({ length: 8 }),
    nama: text().notNull(),
    urut: smallint().notNull().default(0),
    ...ts(),
  },
  (t) => [index().on(t.assetTypeId, t.urut)],
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: id(),
    checklistGroupId: integer()
      .notNull()
      .references(() => checklistGroups.id, { onDelete: "restrict" }),
    label: text().notNull(),
    answerType: answerTypeEnum().notNull().default("kondisi"),
    /** Pilihan untuk answer_type select. */
    options: jsonb().$type<string[]>(),
    /** Pemetaan pilihan ke keparahan, mis. {"Tidak penuh": "berat"}. */
    severityMap: jsonb().$type<Record<string, Severity>>(),
    severityDefault: severityEnum().notNull().default("sedang"),
    /** Acuan Permenakertrans 15/2008 untuk answer_type number. */
    jumlahBaku: smallint(),
    /** Isi P3K: jumlah baku per tipe kotak {A, B, C}; mengalahkan `jumlah_baku` bila ada. */
    jumlahBakuPerTipe: jsonb().$type<Record<TipeKotakP3k, number>>(),
    /** Isi P3K bertanda bintang: jawaban mencatat tanggal kedaluwarsa terdekat. */
    hasExpiry: boolean().notNull().default(false),
    /** Tindakan bawaan untuk temuan dari butir ini; inspektur dapat menggantinya. */
    tindakanBawaan: tindakanRekomendasiEnum(),
    satuan: varchar({ length: 24 }),
    /** Dasar hukum, mis. "Permenaker 4/1980 Pasal 12(1)a". */
    dasarHukum: text(),
    keterangan: text(),
    wajib: boolean().notNull().default(true),
    /** Urutan global per tipe objek, mengikuti Lampiran 03 (kunci seed yang stabil). */
    urut: smallint().notNull().default(0),
    aktif: boolean().notNull().default(true),
    ...ts(),
  },
  (t) => [uniqueIndex().on(t.checklistGroupId, t.urut)],
);

export const inspections = pgTable(
  "inspections",
  {
    /** Dibuat di perangkat (UUIDv7) atau peladen. */
    id: uuid().primaryKey().defaultRandom(),
    /** id Laravel lama (migrasi data). */
    legacyId: integer().unique(),
    assetId: integer()
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: inspectionStatusEnum().notNull().default("draf"),
    // waktu (SPEC §7.6)
    scannedAtDevice: tstz(),
    submittedAtDevice: tstz(),
    /** Tiba di peladen (waktu peladen). */
    receivedAt: tstz(),
    /** Waktu resmi inspeksi. */
    inspectedAt: tstz(),
    mulaiPada: tstz(),
    durasiDetik: integer(),
    clockSkewS: integer(),
    /** Dikirim lewat antrean luring. */
    offline: boolean().notNull().default(false),
    ua: varchar({ length: 255 }),
    // bukti lokasi (SPEC §3.5)
    gpsLat: coord(),
    gpsLng: coord(),
    gpsAccuracy: smallint(),
    gpsCapturedAt: tstz(),
    jarakM: integer(),
    gateStatus: gateStatusEnum().notNull().default("tanpa_gps"),
    /** Alasan bila `gate_status = perlu_tinjauan`. */
    gateAlasan: gateAlasanEnum(),
    /** Area tempat posisi jatuh (poligon terdekat yang memuatnya), bila ada. */
    detectedAreaId: integer().references(() => areas.id, { onDelete: "set null" }),
    /** Jarak posisi ke tepi poligon area aset (0 bila di dalam). */
    jarakKeAreaM: integer(),
    /** Aset berada di area terbatas saat final (salinan): tanpa foto, masuk antrean tinjauan. */
    restrictedArea: boolean().notNull().default(false),
    qrVerified: boolean().notNull().default(false),
    /** "online" | "offline_cache" */
    qrVerification: varchar({ length: 16 }),
    // isi
    kesimpulan: kesimpulanEnum(),
    catatan: text(),
    rekomendasi: text(),
    // tinjauan Administrator K3 atau Pemantau (ADR-9)
    hasilTinjauan: hasilTinjauanEnum(),
    ditinjauPada: tstz(),
    ditinjauOleh: integer().references(() => users.id, { onDelete: "set null" }),
    catatanReview: text(),
    ...ts(),
  },
  (t) => [
    index().on(t.assetId, t.inspectedAt),
    index().on(t.gateStatus, t.inspectedAt),
    index().on(t.userId, t.inspectedAt),
    /** Satu draf per (aset, inspektur) (SPEC §9 #13). */
    uniqueIndex("inspections_satu_draf").on(t.assetId, t.userId).where(sql`status = 'draf'`),
  ],
);

export const inspectionAnswers = pgTable(
  "inspection_answers",
  {
    id: uuid().primaryKey().defaultRandom(),
    inspectionId: uuid()
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    checklistItemId: integer()
      .notNull()
      .references(() => checklistItems.id, { onDelete: "restrict" }),
    /** fungsi/kondisi/boolean: "ok" | "tidak"; select: teks pilihan; date: YYYY-MM-DD. */
    nilai: text(),
    /** number: jumlah (isi P3K), odometer. */
    nilaiAngka: integer(),
    /** Isi P3K: aman / ada yang kedaluwarsa. */
    kondisiIsi: kondisiIsiEnum(),
    /** Isi P3K bertanda bintang: tanggal kedaluwarsa terdekat. */
    tglKedaluwarsaTerdekat: date({ mode: "string" }),
    /** Pengganti tindakan bawaan butir untuk temuan dari jawaban ini. */
    tindakanRekomendasi: tindakanRekomendasiEnum(),
    uraianTindakan: text(),
    catatan: text(),
    answeredAtDevice: tstz(),
    ...ts(),
  },
  (t) => [uniqueIndex().on(t.inspectionId, t.checklistItemId)],
);

/**
 * Foto bukti di Vercel Blob PRIVAT. Tidak ada URL publik: tampilkan lewat
 * GET /api/foto/{id} yang memeriksa sesi (src/lib/storage/photos.ts).
 */
export const inspectionPhotos = pgTable(
  "inspection_photos",
  {
    id: uuid().primaryKey().defaultRandom(),
    inspectionId: uuid()
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    /** Pathname di blob store, mis. inspeksi/{inspectionId}/{id}.jpg */
    storageKey: text().notNull().unique(),
    sha256: varchar({ length: 64 }).notNull(),
    contentType: varchar({ length: 32 }).notNull().default("image/jpeg"),
    bytes: integer(),
    width: smallint(),
    height: smallint(),
    /** Langkah kamera terpandu tempat foto diambil (ADR-8). */
    stepId: integer().references(() => photoSteps.id, { onDelete: "set null" }),
    takenAtDevice: tstz(),
    uploadedAt: tstz().notNull().defaultNow(),
    lat: coord(),
    lng: coord(),
    /** Akurasi GPS (m) saat foto diambil. */
    gpsAccuracy: smallint(),
    ...ts(),
  },
  (t) => [index().on(t.inspectionId), index().on(t.stepId)],
);

/**
 * Urutan langkah foto per tipe aset (kamera terpandu, ADR-8). Mis. APAR: "Manometer".
 */
export const photoSteps = pgTable(
  "photo_steps",
  {
    id: id(),
    assetTypeId: integer()
      .notNull()
      .references(() => assetTypes.id, { onDelete: "cascade" }),
    urut: smallint().notNull().default(0),
    /** Kunci seed stabil per tipe aset (langkahFoto.kode), mis. "manometer". */
    kode: varchar({ length: 32 }),
    judul: text().notNull(),
    petunjuk: text(),
    minFoto: smallint().notNull().default(1),
    maksFoto: smallint().notNull().default(5),
    aktif: boolean().notNull().default(true),
    ...ts(),
  },
  (t) => [uniqueIndex().on(t.assetTypeId, t.urut), uniqueIndex().on(t.assetTypeId, t.kode)],
);

/** Langkah foto -> butir checklist yang dibuktikannya (banyak-ke-banyak). */
export const photoStepItems = pgTable(
  "photo_step_items",
  {
    stepId: integer()
      .notNull()
      .references(() => photoSteps.id, { onDelete: "cascade" }),
    checklistItemId: integer()
      .notNull()
      .references(() => checklistItems.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.stepId, t.checklistItemId] }), index().on(t.checklistItemId)],
);

/**
 * Foto -> butir yang dibuktikan (banyak-ke-banyak). Disalin dari `photo_step_items` saat foto
 * disimpan, supaya bukti inspeksi final tidak berubah bila admin kemudian mengubah pemetaan langkah.
 */
export const inspectionPhotoItems = pgTable(
  "inspection_photo_items",
  {
    photoId: uuid()
      .notNull()
      .references(() => inspectionPhotos.id, { onDelete: "cascade" }),
    checklistItemId: integer()
      .notNull()
      .references(() => checklistItems.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.photoId, t.checklistItemId] }), index().on(t.checklistItemId)],
);

/** Temuan. */
export const issues = pgTable(
  "issues",
  {
    id: id(),
    assetId: integer()
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    inspectionId: uuid().references(() => inspections.id, { onDelete: "set null" }),
    checklistItemId: integer().references(() => checklistItems.id, { onDelete: "set null" }),
    /** Kalimat temuan, mis. "Volume isi tabung: Tidak penuh". */
    item: text().notNull(),
    severity: severityEnum().notNull().default("sedang"),
    /** Lokasi saat final: area/gedung, lantai, keterangan titik (salinan teks). */
    lokasi: text(),
    tindakanRekomendasi: tindakanRekomendasiEnum(),
    uraianTindakan: text(),
    /** v1, tidak dipakai v2 (ADR-4: tanpa alur tindak lanjut); dibiarkan untuk data lama. */
    status: issueStatusEnum().notNull().default("terbuka"),
    tindakLanjut: text(),
    targetSelesai: date({ mode: "string" }),
    selesaiPada: tstz(),
    /** Penanggung jawab (opsional). */
    picUserId: integer().references(() => users.id, { onDelete: "set null" }),
    ...ts(),
  },
  (t) => [index().on(t.assetId, t.status), index().on(t.status, t.severity)],
);

/** Jejak tindak lanjut temuan: tiap perubahan tenggat, status, atau catatan. */
export const issueEvents = pgTable(
  "issue_events",
  {
    id: id(),
    issueId: integer()
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: integer().references(() => users.id, { onDelete: "set null" }),
    /** tenggat | status | catatan | pic */
    aksi: varchar({ length: 32 }).notNull(),
    dari: jsonb(),
    ke: jsonb(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.issueId, t.createdAt)],
);

/** Jadwal kewajiban per aset per periode (bulan). */
export const schedules = pgTable(
  "schedules",
  {
    id: id(),
    assetId: integer()
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    /** Tanggal 1 bulan bersangkutan. */
    periode: date({ mode: "string" }).notNull(),
    jatuhTempo: date({ mode: "string" }).notNull(),
    inspectionId: uuid().references(() => inspections.id, { onDelete: "set null" }),
    status: scheduleStatusEnum().notNull().default("belum"),
    /** Tanggal rencana pemeriksaan di kalender admin (redesain A); null = belum dijadwalkan. */
    tanggalRencana: date({ mode: "string" }),
    ...ts(),
  },
  (t) => [uniqueIndex().on(t.assetId, t.periode), index().on(t.periode, t.status), index().on(t.tanggalRencana)],
);

/** Pengaturan kunci-nilai, mis. toleransi gerbang (SETTING_GERBANG di constants.ts). */
export const settings = pgTable("settings", {
  kunci: varchar({ length: 64 }).primaryKey(),
  nilai: jsonb().$type<unknown>().notNull(),
  keterangan: text(),
  diubahOleh: integer().references(() => users.id, { onDelete: "set null" }),
  ...ts(),
});

/** Idempotensi antrean luring (SPEC §7.5): satu baris per Idempotency-Key. */
export const syncReceipts = pgTable("sync_receipts", {
  key: uuid().primaryKey(),
  userId: integer()
    .notNull()
    .references(() => users.id),
  endpoint: varchar({ length: 64 }).notNull(),
  requestHash: varchar({ length: 64 }).notNull(),
  responseStatus: smallint().notNull(),
  responseBody: jsonb(),
  createdAt: createdAt(),
});

/** Jejak aksi penting (masuk, perubahan data induk, tinjauan, ganti token). */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: integer().references(() => users.id, { onDelete: "set null" }),
    /** mis. "masuk", "masuk.gagal", "aset.ubah", "aset.ganti_token", "inspeksi.tinjau" */
    aksi: varchar({ length: 64 }).notNull(),
    entitas: varchar({ length: 64 }),
    entitasId: text(),
    data: jsonb().$type<Record<string, unknown>>(),
    ip: varchar({ length: 45 }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.aksi, t.createdAt), index().on(t.entitas, t.entitasId)],
);

/* ---------- formulir pertanyaan klien (/tanya/{token}) ---------- */

/**
 * Jawaban klien atas daftar pertanyaan grill-me (src/features/tanya/pertanyaan.ts).
 * Terpisah dari tabel domain: tidak ada FK ke data inspeksi. `formulir` = kunci satu set
 * jawaban (saat ini satu: "rifaldy"), `nomor` = nomor pertanyaan di catatan ("1.2").
 */
export const tanyaJawaban = pgTable(
    "tanya_jawaban",
    {
        id: id(),
        formulir: varchar({ length: 32 }).notNull(),
        nomor: varchar({ length: 8 }).notNull(),
        jawaban: text().notNull().default(""),
        /** Kode pilihan "a"/"b"/"c" bila pertanyaan punya pilihan. */
        pilihan: varchar({ length: 4 }),
        pakaiBawaan: boolean().notNull().default(false),
        perluTanya: boolean().notNull().default(false),
        ...ts(),
    },
    (t) => [uniqueIndex().on(t.formulir, t.nomor)],
);

/** Berkas pendukung per pertanyaan (foto formulir, contoh). Vercel Blob privat, maks 10 MB. */
export const tanyaLampiran = pgTable(
    "tanya_lampiran",
    {
        id: uuid().primaryKey().defaultRandom(),
        formulir: varchar({ length: 32 }).notNull(),
        nomor: varchar({ length: 8 }).notNull(),
        storageKey: text().notNull(),
        nama: text().notNull(),
        contentType: varchar({ length: 128 }).notNull(),
        bytes: integer().notNull(),
        createdAt: createdAt(),
    },
    (t) => [index().on(t.formulir, t.nomor)],
);

/** Status kirim satu formulir. Tetap bisa disunting sesudah dikirim. */
export const tanyaKiriman = pgTable("tanya_kiriman", {
    formulir: varchar({ length: 32 }).primaryKey(),
    dikirimPada: tstz().notNull().defaultNow(),
    jumlahKirim: integer().notNull().default(1),
    ...ts(),
});

/* ---------- relasi ---------- */

export const divisionsRelations = relations(divisions, ({ many }) => ({
  users: many(users),
  assets: many(assets),
  assetTypes: many(assetTypes),
  areas: many(areas),
}));

export const areasRelations = relations(areas, ({ one, many }) => ({
  parent: one(areas, { fields: [areas.parentId], references: [areas.id], relationName: "induk" }),
  children: many(areas, { relationName: "induk" }),
  division: one(divisions, { fields: [areas.divisionId], references: [divisions.id] }),
  assets: many(assets),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  division: one(divisions, { fields: [users.divisionId], references: [divisions.id] }),
  inspections: many(inspections, { relationName: "inspektur" }),
}));

export const assetTypesRelations = relations(assetTypes, ({ one, many }) => ({
  ownerDivision: one(divisions, { fields: [assetTypes.ownerDivisionId], references: [divisions.id] }),
  assets: many(assets),
  checklistGroups: many(checklistGroups),
  photoSteps: many(photoSteps),
}));

export const photoStepsRelations = relations(photoSteps, ({ one, many }) => ({
  assetType: one(assetTypes, { fields: [photoSteps.assetTypeId], references: [assetTypes.id] }),
  items: many(photoStepItems),
  photos: many(inspectionPhotos),
}));

export const photoStepItemsRelations = relations(photoStepItems, ({ one }) => ({
  step: one(photoSteps, { fields: [photoStepItems.stepId], references: [photoSteps.id] }),
  checklistItem: one(checklistItems, { fields: [photoStepItems.checklistItemId], references: [checklistItems.id] }),
}));

export const inspectionPhotoItemsRelations = relations(inspectionPhotoItems, ({ one }) => ({
  photo: one(inspectionPhotos, { fields: [inspectionPhotoItems.photoId], references: [inspectionPhotos.id] }),
  checklistItem: one(checklistItems, {
    fields: [inspectionPhotoItems.checklistItemId],
    references: [checklistItems.id],
  }),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  assetType: one(assetTypes, { fields: [assets.assetTypeId], references: [assetTypes.id] }),
  division: one(divisions, { fields: [assets.divisionId], references: [divisions.id] }),
  area: one(areas, { fields: [assets.areaId], references: [areas.id] }),
  inspections: many(inspections),
  issues: many(issues),
  schedules: many(schedules),
}));

export const checklistGroupsRelations = relations(checklistGroups, ({ one, many }) => ({
  assetType: one(assetTypes, { fields: [checklistGroups.assetTypeId], references: [assetTypes.id] }),
  items: many(checklistItems),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one, many }) => ({
  group: one(checklistGroups, { fields: [checklistItems.checklistGroupId], references: [checklistGroups.id] }),
  answers: many(inspectionAnswers),
  photoSteps: many(photoStepItems),
}));

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  asset: one(assets, { fields: [inspections.assetId], references: [assets.id] }),
  user: one(users, { fields: [inspections.userId], references: [users.id], relationName: "inspektur" }),
  peninjau: one(users, { fields: [inspections.ditinjauOleh], references: [users.id] }),
  detectedArea: one(areas, { fields: [inspections.detectedAreaId], references: [areas.id] }),
  answers: many(inspectionAnswers),
  photos: many(inspectionPhotos),
  issues: many(issues),
}));

export const inspectionAnswersRelations = relations(inspectionAnswers, ({ one }) => ({
  inspection: one(inspections, { fields: [inspectionAnswers.inspectionId], references: [inspections.id] }),
  checklistItem: one(checklistItems, {
    fields: [inspectionAnswers.checklistItemId],
    references: [checklistItems.id],
  }),
}));

export const inspectionPhotosRelations = relations(inspectionPhotos, ({ one, many }) => ({
  inspection: one(inspections, { fields: [inspectionPhotos.inspectionId], references: [inspections.id] }),
  step: one(photoSteps, { fields: [inspectionPhotos.stepId], references: [photoSteps.id] }),
  items: many(inspectionPhotoItems),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  asset: one(assets, { fields: [issues.assetId], references: [assets.id] }),
  inspection: one(inspections, { fields: [issues.inspectionId], references: [inspections.id] }),
  checklistItem: one(checklistItems, { fields: [issues.checklistItemId], references: [checklistItems.id] }),
  pic: one(users, { fields: [issues.picUserId], references: [users.id] }),
  events: many(issueEvents),
}));

export const issueEventsRelations = relations(issueEvents, ({ one }) => ({
  issue: one(issues, { fields: [issueEvents.issueId], references: [issues.id] }),
  user: one(users, { fields: [issueEvents.userId], references: [users.id] }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  asset: one(assets, { fields: [schedules.assetId], references: [assets.id] }),
  inspection: one(inspections, { fields: [schedules.inspectionId], references: [inspections.id] }),
}));

export type User = typeof users.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Inspection = typeof inspections.$inferSelect;
export type InspectionPhoto = typeof inspectionPhotos.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type AssetType = typeof assetTypes.$inferSelect;
export type PhotoStep = typeof photoSteps.$inferSelect;
export type Setting = typeof settings.$inferSelect;
