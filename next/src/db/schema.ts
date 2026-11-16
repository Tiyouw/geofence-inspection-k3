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
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  ANSWER_TYPES,
  GATE_STATUSES,
  INSPECTION_STATUSES,
  ISSUE_STATUSES,
  KESIMPULAN,
  LOKASI_TIPE,
  ROLES,
  SCHEDULE_STATUSES,
  SEVERITIES,
  type Severity,
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
    lastLoginAt: tstz(),
    ...ts(),
  },
  (t) => [index().on(t.role, t.aktif)],
);

export const assetTypes = pgTable("asset_types", {
  id: id(),
  /** apar, hydrant, p3k, damkar */
  slug: varchar({ length: 32 }).notNull().unique(),
  nama: text().notNull(),
  /** Objek bergerak (mobil pemadam): gerbang GPS tidak diberlakukan. */
  isMobile: boolean().notNull().default(false),
  periodeHari: smallint().notNull().default(30),
  urut: smallint().notNull().default(0),
  aktif: boolean().notNull().default(true),
  ...ts(),
});

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
    gedung: varchar({ length: 64 }),
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
    attributes: jsonb().$type<{ tipe?: string; jenis?: string; kapasitas_kg?: number } & Record<string, unknown>>(),
    tglExpired: date({ mode: "string" }),
    terakhirDicek: date({ mode: "string" }),
    aktif: boolean().notNull().default(true),
    ...ts(),
  },
  (t) => [uniqueIndex().on(t.assetTypeId, t.kode), index().on(t.assetTypeId, t.aktif), index().on(t.gedung)],
);

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
    qrVerified: boolean().notNull().default(false),
    /** "online" | "offline_cache" */
    qrVerification: varchar({ length: 16 }),
    // isi
    kesimpulan: kesimpulanEnum(),
    catatan: text(),
    rekomendasi: text(),
    // tinjauan admin
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
    nilaiAngka: integer(),
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
    takenAtDevice: tstz(),
    uploadedAt: tstz().notNull().defaultNow(),
    lat: coord(),
    lng: coord(),
    ...ts(),
  },
  (t) => [index().on(t.inspectionId)],
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
    ...ts(),
  },
  (t) => [uniqueIndex().on(t.assetId, t.periode), index().on(t.periode, t.status)],
);

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

/* ---------- relasi ---------- */

export const divisionsRelations = relations(divisions, ({ many }) => ({
  users: many(users),
  assets: many(assets),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  division: one(divisions, { fields: [users.divisionId], references: [divisions.id] }),
  inspections: many(inspections, { relationName: "inspektur" }),
}));

export const assetTypesRelations = relations(assetTypes, ({ many }) => ({
  assets: many(assets),
  checklistGroups: many(checklistGroups),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  assetType: one(assetTypes, { fields: [assets.assetTypeId], references: [assetTypes.id] }),
  division: one(divisions, { fields: [assets.divisionId], references: [divisions.id] }),
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
}));

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  asset: one(assets, { fields: [inspections.assetId], references: [assets.id] }),
  user: one(users, { fields: [inspections.userId], references: [users.id], relationName: "inspektur" }),
  peninjau: one(users, { fields: [inspections.ditinjauOleh], references: [users.id] }),
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

export const inspectionPhotosRelations = relations(inspectionPhotos, ({ one }) => ({
  inspection: one(inspections, { fields: [inspectionPhotos.inspectionId], references: [inspections.id] }),
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
