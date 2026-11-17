CREATE TYPE "public"."area_jenis" AS ENUM('kawasan', 'gedung', 'bengkel', 'dok', 'dermaga');--> statement-breakpoint
CREATE TYPE "public"."gate_alasan" AS ENUM('di_luar_gedung', 'gps_lemah');--> statement-breakpoint
CREATE TYPE "public"."hasil_tinjauan" AS ENUM('diterima', 'ditolak');--> statement-breakpoint
CREATE TYPE "public"."kondisi_isi" AS ENUM('aman', 'kedaluwarsa');--> statement-breakpoint
CREATE TYPE "public"."tindakan_rekomendasi" AS ENUM('perbaiki', 'ganti', 'isi_ulang', 'lengkapi', 'lainnya');--> statement-breakpoint
ALTER TYPE "public"."gate_status" ADD VALUE 'perlu_tinjauan';--> statement-breakpoint
CREATE TABLE "areas" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "areas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kode" varchar(32) NOT NULL,
	"nama" text NOT NULL,
	"jenis" "area_jenis" DEFAULT 'gedung' NOT NULL,
	"polygon" jsonb,
	"polygon_draf" jsonb,
	"poligon_disetujui_pada" timestamp with time zone,
	"poligon_disetujui_oleh" integer,
	"restricted" boolean DEFAULT false NOT NULL,
	"parent_id" integer,
	"division_id" integer,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "areas_kode_unique" UNIQUE("kode")
);
--> statement-breakpoint
CREATE TABLE "inspection_photo_items" (
	"photo_id" uuid NOT NULL,
	"checklist_item_id" integer NOT NULL,
	CONSTRAINT "inspection_photo_items_photo_id_checklist_item_id_pk" PRIMARY KEY("photo_id","checklist_item_id")
);
--> statement-breakpoint
CREATE TABLE "photo_step_items" (
	"step_id" integer NOT NULL,
	"checklist_item_id" integer NOT NULL,
	CONSTRAINT "photo_step_items_step_id_checklist_item_id_pk" PRIMARY KEY("step_id","checklist_item_id")
);
--> statement-breakpoint
CREATE TABLE "photo_steps" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "photo_steps_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asset_type_id" integer NOT NULL,
	"urut" smallint DEFAULT 0 NOT NULL,
	"kode" varchar(32),
	"judul" text NOT NULL,
	"petunjuk" text,
	"min_foto" smallint DEFAULT 1 NOT NULL,
	"maks_foto" smallint DEFAULT 5 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"kunci" varchar(64) PRIMARY KEY NOT NULL,
	"nilai" jsonb NOT NULL,
	"keterangan" text,
	"diubah_oleh" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "asset_types" ADD COLUMN "owner_division_id" integer;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "area_id" integer;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "jumlah_baku_per_tipe" jsonb;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "has_expiry" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD COLUMN "tindakan_bawaan" "tindakan_rekomendasi";--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD COLUMN "kondisi_isi" "kondisi_isi";--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD COLUMN "tgl_kedaluwarsa_terdekat" date;--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD COLUMN "tindakan_rekomendasi" "tindakan_rekomendasi";--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD COLUMN "uraian_tindakan" text;--> statement-breakpoint
ALTER TABLE "inspection_photos" ADD COLUMN "step_id" integer;--> statement-breakpoint
ALTER TABLE "inspection_photos" ADD COLUMN "gps_accuracy" smallint;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "gate_alasan" "gate_alasan";--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "detected_area_id" integer;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "jarak_ke_area_m" integer;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "restricted_area" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "hasil_tinjauan" "hasil_tinjauan";--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "lokasi" text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "tindakan_rekomendasi" "tindakan_rekomendasi";--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "uraian_tindakan" text;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_poligon_disetujui_oleh_users_id_fk" FOREIGN KEY ("poligon_disetujui_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_parent_id_areas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "areas" ADD CONSTRAINT "areas_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_photo_items" ADD CONSTRAINT "inspection_photo_items_photo_id_inspection_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."inspection_photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_photo_items" ADD CONSTRAINT "inspection_photo_items_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_step_items" ADD CONSTRAINT "photo_step_items_step_id_photo_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."photo_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_step_items" ADD CONSTRAINT "photo_step_items_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_steps" ADD CONSTRAINT "photo_steps_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_diubah_oleh_users_id_fk" FOREIGN KEY ("diubah_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "areas_jenis_aktif_index" ON "areas" USING btree ("jenis","aktif");--> statement-breakpoint
CREATE INDEX "areas_parent_id_index" ON "areas" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "inspection_photo_items_checklist_item_id_index" ON "inspection_photo_items" USING btree ("checklist_item_id");--> statement-breakpoint
CREATE INDEX "photo_step_items_checklist_item_id_index" ON "photo_step_items" USING btree ("checklist_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "photo_steps_asset_type_id_urut_index" ON "photo_steps" USING btree ("asset_type_id","urut");--> statement-breakpoint
CREATE UNIQUE INDEX "photo_steps_asset_type_id_kode_index" ON "photo_steps" USING btree ("asset_type_id","kode");--> statement-breakpoint
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_owner_division_id_divisions_id_fk" FOREIGN KEY ("owner_division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_step_id_photo_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."photo_steps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_detected_area_id_areas_id_fk" FOREIGN KEY ("detected_area_id") REFERENCES "public"."areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assets_area_id_index" ON "assets" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "inspection_photos_step_id_index" ON "inspection_photos" USING btree ("step_id");--> statement-breakpoint
-- Toleransi gerbang (PRD "Aturan gerbang lokasi", ADR-7). Disetel di lapangan lewat tabel ini.
INSERT INTO "settings" ("kunci", "nilai", "keterangan") VALUES
  ('gerbang.toleransi_gedung_m', '30', 'Jarak maksimum (m) ke tepi poligon area aset untuk status sesuai'),
  ('gerbang.toleransi_kawasan_m', '50', 'Pelebaran (m) poligon kawasan galangan sebelum ditolak'),
  ('gerbang.akurasi_lemah_m', '100', 'Akurasi GPS (m) di atas nilai ini = perlu tinjauan (GPS lemah)')
ON CONFLICT ("kunci") DO NOTHING;--> statement-breakpoint
-- Alasan untuk status gerbang v1 yang sudah tersimpan (Tech Spec migrasi 3). Status lama tidak diubah.
UPDATE "inspections" SET "gate_alasan" = 'di_luar_gedung' WHERE "gate_status" IN ('perlu_review', 'jauh') AND "gate_alasan" IS NULL;--> statement-breakpoint
UPDATE "inspections" SET "gate_alasan" = 'gps_lemah' WHERE "gate_status" IN ('gps_lemah', 'tanpa_gps') AND "gate_alasan" IS NULL;
