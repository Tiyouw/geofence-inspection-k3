/**
 * Skema domain PAL-K3. Mencerminkan migrasi Laravel (database/migrations) dengan
 * beberapa penyesuaian yang dicatat di docs/v2/ARCHITECTURE.md:
 *   - lokasi dipisah ke tabel `locations` (gedung/lantai/area), aset tetap boleh
 *     menyimpan koordinat titiknya sendiri;
 *   - token QR dipisah ke `qr_tokens` supaya stiker bisa dicabut dan diganti;
 *   - `issue_followups` mencatat riwayat tindak lanjut temuan;
 *   - `audit_logs` mencatat aksi penting;
 *   - `inspections.client_id` untuk antrean luring (idempoten saat dikirim ulang).
 *
 * Nama kolom di basis data snake_case (lihat `casing` di drizzle.config.ts dan src/db/index.ts).
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
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
} from "@/lib/domain/constants";

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
/** decimal(10,7) seperti Laravel; dibaca sebagai number. */
const coord = () => numeric({ precision: 10, scale: 7, mode: "number" });

export const divisions = pgTable("divisions", {
  id: id(),
  nama: text().notNull(),
  kode: varchar({ length: 32 }).unique(),
  aktif: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    name: text().notNull(),
    /** Nama pengguna untuk masuk: NIP, atau "admin"/"pemantau"/"inspektur" untuk akun demo. */
    nip: varchar({ length: 32 }).notNull().unique(),
    email: text().unique(),
    passwordHash: text().notNull(),
    role: text({ enum: ROLES }).notNull().default("inspektur"),
    jabatan: text(),
    divisionId: integer().references(() => divisions.id, { onDelete: "set null" }),
    aktif: boolean().notNull().default(true),
    lastLoginAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.role, t.aktif)],
);

export const assetTypes = pgTable("asset_types", {
  id: id(),
  /** apar, hydrant, p3k, damkar */
  slug: varchar({ length: 32 }).notNull().unique(),
  nama: text().notNull(),
  /** true = objek bergerak (mobil pemadam), gerbang GPS tidak diberlakukan. */
  isMobile: boolean().notNull().default(false),
  periodeHari: smallint().notNull().default(30),
  urut: smallint().notNull().default(0),
  aktif: boolean().notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Gedung/lantai/area. Titik pusat dan radius bawaan untuk aset di dalamnya. */
export const locations = pgTable(
  "locations",
  {
    id: id(),
    gedung: text().notNull(),
    /** "Lt. 1", atau null untuk area tanpa lantai. */
    lantai: text(),
    lokasiTipe: text({ enum: LOKASI_TIPE }).notNull().default("dalam_gedung"),
    lat: coord(),
    lng: coord(),
    /** Override radius gerbang GPS untuk seluruh area; null = ikut jenis lokasi. */
    radiusM: smallint(),
    aktif: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [unique().on(t.gedung, t.lantai).nullsNotDistinct()],
);

export const assets = pgTable(
  "assets",
  {
    id: id(),
    assetTypeId: integer()
      .notNull()
      .references(() => assetTypes.id, { onDelete: "restrict", onUpdate: "cascade" }),
    divisionId: integer().references(() => divisions.id, { onDelete: "set null" }),
    locationId: integer().references(() => locations.id, { onDelete: "set null" }),
    /** Nomor aset, mis. 01D. */
    kode: varchar({ length: 32 }).notNull(),
    /** Keterangan titik, mis. "Lorong Timur titik 1". */
    lokasiTeks: text().notNull(),
    /** Koordinat titik aset; kalau kosong pakai koordinat lokasi. */
    lat: coord(),
    lng: coord(),
    /** Override radius per aset (Bagian 5.5). */
    radiusM: smallint(),
    /** {tipe, kapasitas_kg, ...} */
    attributes: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    tglExpired: date({ mode: "string" }),
    terakhirDicek: date({ mode: "string" }),
    aktif: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex().on(t.assetTypeId, t.kode),
    index().on(t.assetTypeId, t.aktif),
    index().on(t.locationId),
  ],
);

/**
 * Token QR pada stiker. Acak, bukan nomor aset: satu-satunya gerbang penentu aset
 * saat inspeksi dimulai, jadi tidak pernah ditulis ke berkas seed atau repo.
 * Satu aset punya paling banyak satu token aktif; token lama dicabut saat stiker diganti.
 */
export const qrTokens = pgTable(
  "qr_tokens",
  {
    id: id(),
    assetId: integer()
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    token: varchar({ length: 64 }).notNull().unique(),
    aktif: boolean().notNull().default(true),
    dicabutPada: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("qr_tokens_satu_aktif_per_aset").on(t.assetId).where(sql`${t.aktif}`)],
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
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.assetTypeId, t.urut)],
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id: id(),
    checklistGroupId: integer()
      .notNull()
      .references(() => checklistGroups.id, { onDelete: "cascade" }),
    label: text().notNull(),
    answerType: text({ enum: ANSWER_TYPES }).notNull().default("kondisi"),
    /** Pilihan untuk answer_type select. */
    options: jsonb().$type<string[]>(),
    /** Acuan Permenakertrans 15/2008 untuk answer_type number. */
    jumlahBaku: smallint(),
    satuan: varchar({ length: 24 }),
    /** Dasar hukum, mis. "Permenaker 4/1980 Pasal 12(1)a". */
    dasarHukum: text(),
    keterangan: text(),
    severityDefault: text({ enum: SEVERITIES }).notNull().default("sedang"),
    /** Pemetaan pilihan ke keparahan, mis. {"Tidak penuh": "berat"}. */
    severityMap: jsonb().$type<Record<string, (typeof SEVERITIES)[number]>>(),
    wajib: boolean().notNull().default(true),
    urut: smallint().notNull().default(0),
    aktif: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.checklistGroupId, t.urut)],
);

export const inspections = pgTable(
  "inspections",
  {
    id: id(),
    /** UUID dari perangkat: pengiriman ulang antrean luring tidak menggandakan inspeksi. */
    clientId: uuid().unique(),
    assetId: integer()
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    userId: integer()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    qrTokenId: integer().references(() => qrTokens.id, { onDelete: "set null" }),
    /** Waktu peladen saat final, bukan waktu perangkat (cegah putar balik jam ponsel). */
    inspectedAt: timestamp({ withTimezone: true }),
    mulaiPada: timestamp({ withTimezone: true }),
    durasiDetik: integer(),
    deviceTime: timestamp({ withTimezone: true }),
    ua: varchar({ length: 255 }),
    gpsLat: coord(),
    gpsLng: coord(),
    /** meter */
    gpsAccuracy: smallint(),
    /** Jarak ke titik aset, meter. */
    jarakM: integer(),
    qrVerified: boolean().notNull().default(false),
    gateStatus: text({ enum: GATE_STATUSES }).notNull().default("tanpa_gps"),
    catatan: text(),
    rekomendasi: text(),
    status: text({ enum: INSPECTION_STATUSES }).notNull().default("draft"),
    kesimpulan: text({ enum: KESIMPULAN }),
    ditinjauPada: timestamp({ withTimezone: true }),
    ditinjauOleh: integer().references(() => users.id, { onDelete: "set null" }),
    catatanReview: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.assetId, t.inspectedAt),
    index().on(t.gateStatus, t.inspectedAt),
    index().on(t.userId, t.inspectedAt),
  ],
);

export const inspectionAnswers = pgTable(
  "inspection_answers",
  {
    id: id(),
    inspectionId: integer()
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    checklistItemId: integer()
      .notNull()
      .references(() => checklistItems.id, { onDelete: "restrict" }),
    /** fungsi/kondisi/boolean: "ok" | "tidak"; select: teks pilihan. */
    nilai: varchar({ length: 64 }),
    nilaiAngka: integer(),
    catatan: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.inspectionId, t.checklistItemId)],
);

/** Foto disimpan di Vercel Blob; kolom `url` adalah URL blob, `pathname` kuncinya. */
export const inspectionPhotos = pgTable(
  "inspection_photos",
  {
    id: id(),
    inspectionId: integer()
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    /** Foto untuk butir tertentu (opsional). */
    checklistItemId: integer().references(() => checklistItems.id, { onDelete: "set null" }),
    url: text().notNull(),
    pathname: text().notNull(),
    takenAt: timestamp({ withTimezone: true }),
    lat: coord(),
    lng: coord(),
    bytes: integer(),
    createdAt: createdAt(),
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
    inspectionId: integer().references(() => inspections.id, { onDelete: "set null" }),
    checklistItemId: integer().references(() => checklistItems.id, { onDelete: "set null" }),
    /** Ringkasan temuan. */
    item: text().notNull(),
    severity: text({ enum: SEVERITIES }).notNull().default("sedang"),
    status: text({ enum: ISSUE_STATUSES }).notNull().default("terbuka"),
    tindakLanjut: text(),
    penanggungJawabId: integer().references(() => users.id, { onDelete: "set null" }),
    targetSelesai: date({ mode: "string" }),
    selesaiPada: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.assetId, t.status), index().on(t.status, t.severity)],
);

/** Riwayat tindak lanjut temuan: tiap perubahan status atau catatan. */
export const issueFollowups = pgTable(
  "issue_followups",
  {
    id: id(),
    issueId: integer()
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: integer().references(() => users.id, { onDelete: "set null" }),
    statusBaru: text({ enum: ISSUE_STATUSES }),
    catatan: text(),
    fotoUrl: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.issueId, t.createdAt)],
);

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
    petugasId: integer().references(() => users.id, { onDelete: "set null" }),
    inspectionId: integer().references(() => inspections.id, { onDelete: "set null" }),
    status: text({ enum: SCHEDULE_STATUSES }).notNull().default("belum"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex().on(t.assetId, t.periode), index().on(t.periode, t.status)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: integer().references(() => users.id, { onDelete: "set null" }),
    /** mis. "masuk", "inspeksi.final", "aset.ubah", "temuan.status" */
    aksi: varchar({ length: 64 }).notNull(),
    entitas: varchar({ length: 64 }),
    entitasId: integer(),
    data: jsonb().$type<Record<string, unknown>>(),
    ip: varchar({ length: 45 }),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.entitas, t.entitasId), index().on(t.createdAt)],
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

export const locationsRelations = relations(locations, ({ many }) => ({
  assets: many(assets),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  assetType: one(assetTypes, { fields: [assets.assetTypeId], references: [assetTypes.id] }),
  division: one(divisions, { fields: [assets.divisionId], references: [divisions.id] }),
  location: one(locations, { fields: [assets.locationId], references: [locations.id] }),
  qrTokens: many(qrTokens),
  inspections: many(inspections),
  issues: many(issues),
  schedules: many(schedules),
}));

export const qrTokensRelations = relations(qrTokens, ({ one }) => ({
  asset: one(assets, { fields: [qrTokens.assetId], references: [assets.id] }),
}));

export const checklistGroupsRelations = relations(checklistGroups, ({ one, many }) => ({
  assetType: one(assetTypes, {
    fields: [checklistGroups.assetTypeId],
    references: [assetTypes.id],
  }),
  items: many(checklistItems),
}));

export const checklistItemsRelations = relations(checklistItems, ({ one, many }) => ({
  group: one(checklistGroups, {
    fields: [checklistItems.checklistGroupId],
    references: [checklistGroups.id],
  }),
  answers: many(inspectionAnswers),
}));

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  asset: one(assets, { fields: [inspections.assetId], references: [assets.id] }),
  user: one(users, {
    fields: [inspections.userId],
    references: [users.id],
    relationName: "inspektur",
  }),
  peninjau: one(users, { fields: [inspections.ditinjauOleh], references: [users.id] }),
  answers: many(inspectionAnswers),
  photos: many(inspectionPhotos),
  issues: many(issues),
}));

export const inspectionAnswersRelations = relations(inspectionAnswers, ({ one }) => ({
  inspection: one(inspections, {
    fields: [inspectionAnswers.inspectionId],
    references: [inspections.id],
  }),
  checklistItem: one(checklistItems, {
    fields: [inspectionAnswers.checklistItemId],
    references: [checklistItems.id],
  }),
}));

export const inspectionPhotosRelations = relations(inspectionPhotos, ({ one }) => ({
  inspection: one(inspections, {
    fields: [inspectionPhotos.inspectionId],
    references: [inspections.id],
  }),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  asset: one(assets, { fields: [issues.assetId], references: [assets.id] }),
  inspection: one(inspections, { fields: [issues.inspectionId], references: [inspections.id] }),
  checklistItem: one(checklistItems, {
    fields: [issues.checklistItemId],
    references: [checklistItems.id],
  }),
  followups: many(issueFollowups),
}));

export const issueFollowupsRelations = relations(issueFollowups, ({ one }) => ({
  issue: one(issues, { fields: [issueFollowups.issueId], references: [issues.id] }),
  user: one(users, { fields: [issueFollowups.userId], references: [users.id] }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  asset: one(assets, { fields: [schedules.assetId], references: [assets.id] }),
  inspection: one(inspections, {
    fields: [schedules.inspectionId],
    references: [inspections.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Inspection = typeof inspections.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type Issue = typeof issues.$inferSelect;
