CREATE TYPE "public"."answer_type" AS ENUM('fungsi', 'kondisi', 'boolean', 'select', 'number', 'date', 'text');--> statement-breakpoint
CREATE TYPE "public"."gate_status" AS ENUM('sesuai', 'perlu_review', 'jauh', 'gps_lemah', 'tanpa_gps', 'tidak_berlaku');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('draf', 'final');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('terbuka', 'proses', 'selesai');--> statement-breakpoint
CREATE TYPE "public"."kesimpulan" AS ENUM('layak', 'layak_catatan', 'tidak_layak');--> statement-breakpoint
CREATE TYPE "public"."lokasi_tipe" AS ENUM('dalam_gedung', 'bengkel', 'area_terbuka', 'kendaraan');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'pemantau', 'inspektur');--> statement-breakpoint
CREATE TYPE "public"."schedule_status" AS ENUM('belum', 'selesai', 'telat');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('ringan', 'sedang', 'berat');--> statement-breakpoint
CREATE TABLE "asset_types" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_types_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"slug" varchar(32) NOT NULL,
	"nama" text NOT NULL,
	"is_mobile" boolean DEFAULT false NOT NULL,
	"periode_hari" smallint DEFAULT 30 NOT NULL,
	"urut" smallint DEFAULT 0 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_types_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asset_type_id" integer NOT NULL,
	"division_id" integer,
	"kode" varchar(32) NOT NULL,
	"gedung" varchar(64),
	"lantai" varchar(16),
	"lokasi_teks" text NOT NULL,
	"lokasi_tipe" "lokasi_tipe" DEFAULT 'dalam_gedung' NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"radius_m" smallint,
	"qr_token" varchar(64) NOT NULL,
	"qr_token_rotated_at" timestamp with time zone,
	"attributes" jsonb,
	"tgl_expired" date,
	"terakhir_dicek" date,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_qrToken_unique" UNIQUE("qr_token")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer,
	"aksi" varchar(64) NOT NULL,
	"entitas" varchar(64),
	"entitas_id" text,
	"data" jsonb,
	"ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checklist_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asset_type_id" integer NOT NULL,
	"kode" varchar(8),
	"nama" text NOT NULL,
	"urut" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "checklist_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"checklist_group_id" integer NOT NULL,
	"label" text NOT NULL,
	"answer_type" "answer_type" DEFAULT 'kondisi' NOT NULL,
	"options" jsonb,
	"severity_map" jsonb,
	"severity_default" "severity" DEFAULT 'sedang' NOT NULL,
	"jumlah_baku" smallint,
	"satuan" varchar(24),
	"dasar_hukum" text,
	"keterangan" text,
	"wajib" boolean DEFAULT true NOT NULL,
	"urut" smallint DEFAULT 0 NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "divisions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nama" text NOT NULL,
	"kode" varchar(16),
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "divisions_kode_unique" UNIQUE("kode")
);
--> statement-breakpoint
CREATE TABLE "inspection_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"checklist_item_id" integer NOT NULL,
	"nilai" text,
	"nilai_angka" integer,
	"catatan" text,
	"answered_at_device" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"content_type" varchar(32) DEFAULT 'image/jpeg' NOT NULL,
	"bytes" integer,
	"width" smallint,
	"height" smallint,
	"taken_at_device" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspection_photos_storageKey_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" integer,
	"asset_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"status" "inspection_status" DEFAULT 'draf' NOT NULL,
	"scanned_at_device" timestamp with time zone,
	"submitted_at_device" timestamp with time zone,
	"received_at" timestamp with time zone,
	"inspected_at" timestamp with time zone,
	"mulai_pada" timestamp with time zone,
	"durasi_detik" integer,
	"clock_skew_s" integer,
	"offline" boolean DEFAULT false NOT NULL,
	"ua" varchar(255),
	"gps_lat" numeric(10, 7),
	"gps_lng" numeric(10, 7),
	"gps_accuracy" smallint,
	"gps_captured_at" timestamp with time zone,
	"jarak_m" integer,
	"gate_status" "gate_status" DEFAULT 'tanpa_gps' NOT NULL,
	"qr_verified" boolean DEFAULT false NOT NULL,
	"qr_verification" varchar(16),
	"kesimpulan" "kesimpulan",
	"catatan" text,
	"rekomendasi" text,
	"ditinjau_pada" timestamp with time zone,
	"ditinjau_oleh" integer,
	"catatan_review" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspections_legacyId_unique" UNIQUE("legacy_id")
);
--> statement-breakpoint
CREATE TABLE "issue_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "issue_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"issue_id" integer NOT NULL,
	"user_id" integer,
	"aksi" varchar(32) NOT NULL,
	"dari" jsonb,
	"ke" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "issues_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asset_id" integer NOT NULL,
	"inspection_id" uuid,
	"checklist_item_id" integer,
	"item" text NOT NULL,
	"severity" "severity" DEFAULT 'sedang' NOT NULL,
	"status" "issue_status" DEFAULT 'terbuka' NOT NULL,
	"tindak_lanjut" text,
	"target_selesai" date,
	"selesai_pada" timestamp with time zone,
	"pic_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "schedules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asset_id" integer NOT NULL,
	"periode" date NOT NULL,
	"jatuh_tempo" date NOT NULL,
	"inspection_id" uuid,
	"status" "schedule_status" DEFAULT 'belum' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_receipts" (
	"key" uuid PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" varchar(64) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"response_status" smallint NOT NULL,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nip" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'inspektur' NOT NULL,
	"jabatan" text,
	"division_id" integer,
	"aktif" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_nip_unique" UNIQUE("nip"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_groups" ADD CONSTRAINT "checklist_groups_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_group_id_checklist_groups_id_fk" FOREIGN KEY ("checklist_group_id") REFERENCES "public"."checklist_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD CONSTRAINT "inspection_answers_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD CONSTRAINT "inspection_answers_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_ditinjau_oleh_users_id_fk" FOREIGN KEY ("ditinjau_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_events" ADD CONSTRAINT "issue_events_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_events" ADD CONSTRAINT "issue_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_pic_user_id_users_id_fk" FOREIGN KEY ("pic_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_receipts" ADD CONSTRAINT "sync_receipts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_asset_type_id_kode_index" ON "assets" USING btree ("asset_type_id","kode");--> statement-breakpoint
CREATE INDEX "assets_asset_type_id_aktif_index" ON "assets" USING btree ("asset_type_id","aktif");--> statement-breakpoint
CREATE INDEX "assets_gedung_index" ON "assets" USING btree ("gedung");--> statement-breakpoint
CREATE INDEX "audit_logs_aksi_created_at_index" ON "audit_logs" USING btree ("aksi","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entitas_entitas_id_index" ON "audit_logs" USING btree ("entitas","entitas_id");--> statement-breakpoint
CREATE INDEX "checklist_groups_asset_type_id_urut_index" ON "checklist_groups" USING btree ("asset_type_id","urut");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_items_checklist_group_id_urut_index" ON "checklist_items" USING btree ("checklist_group_id","urut");--> statement-breakpoint
CREATE UNIQUE INDEX "inspection_answers_inspection_id_checklist_item_id_index" ON "inspection_answers" USING btree ("inspection_id","checklist_item_id");--> statement-breakpoint
CREATE INDEX "inspection_photos_inspection_id_index" ON "inspection_photos" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "inspections_asset_id_inspected_at_index" ON "inspections" USING btree ("asset_id","inspected_at");--> statement-breakpoint
CREATE INDEX "inspections_gate_status_inspected_at_index" ON "inspections" USING btree ("gate_status","inspected_at");--> statement-breakpoint
CREATE INDEX "inspections_user_id_inspected_at_index" ON "inspections" USING btree ("user_id","inspected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inspections_satu_draf" ON "inspections" USING btree ("asset_id","user_id") WHERE status = 'draf';--> statement-breakpoint
CREATE INDEX "issue_events_issue_id_created_at_index" ON "issue_events" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issues_asset_id_status_index" ON "issues" USING btree ("asset_id","status");--> statement-breakpoint
CREATE INDEX "issues_status_severity_index" ON "issues" USING btree ("status","severity");--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_asset_id_periode_index" ON "schedules" USING btree ("asset_id","periode");--> statement-breakpoint
CREATE INDEX "schedules_periode_status_index" ON "schedules" USING btree ("periode","status");--> statement-breakpoint
CREATE INDEX "users_role_aktif_index" ON "users" USING btree ("role","aktif");