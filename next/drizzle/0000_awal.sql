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
	"location_id" integer,
	"kode" varchar(32) NOT NULL,
	"lokasi_teks" text NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"radius_m" smallint,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tgl_expired" date,
	"terakhir_dicek" date,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer,
	"aksi" varchar(64) NOT NULL,
	"entitas" varchar(64),
	"entitas_id" integer,
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
	"answer_type" text DEFAULT 'kondisi' NOT NULL,
	"options" jsonb,
	"jumlah_baku" smallint,
	"satuan" varchar(24),
	"dasar_hukum" text,
	"keterangan" text,
	"severity_default" text DEFAULT 'sedang' NOT NULL,
	"severity_map" jsonb,
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
	"kode" varchar(32),
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "divisions_kode_unique" UNIQUE("kode")
);
--> statement-breakpoint
CREATE TABLE "inspection_answers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inspection_answers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"inspection_id" integer NOT NULL,
	"checklist_item_id" integer NOT NULL,
	"nilai" varchar(64),
	"nilai_angka" integer,
	"catatan" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_photos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inspection_photos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"inspection_id" integer NOT NULL,
	"checklist_item_id" integer,
	"url" text NOT NULL,
	"pathname" text NOT NULL,
	"taken_at" timestamp with time zone,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inspections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"client_id" uuid,
	"asset_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"qr_token_id" integer,
	"inspected_at" timestamp with time zone,
	"mulai_pada" timestamp with time zone,
	"durasi_detik" integer,
	"device_time" timestamp with time zone,
	"ua" varchar(255),
	"gps_lat" numeric(10, 7),
	"gps_lng" numeric(10, 7),
	"gps_accuracy" smallint,
	"jarak_m" integer,
	"qr_verified" boolean DEFAULT false NOT NULL,
	"gate_status" text DEFAULT 'tanpa_gps' NOT NULL,
	"catatan" text,
	"rekomendasi" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"kesimpulan" text,
	"ditinjau_pada" timestamp with time zone,
	"ditinjau_oleh" integer,
	"catatan_review" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspections_clientId_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "issue_followups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "issue_followups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"issue_id" integer NOT NULL,
	"user_id" integer,
	"status_baru" text,
	"catatan" text,
	"foto_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "issues_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asset_id" integer NOT NULL,
	"inspection_id" integer,
	"checklist_item_id" integer,
	"item" text NOT NULL,
	"severity" text DEFAULT 'sedang' NOT NULL,
	"status" text DEFAULT 'terbuka' NOT NULL,
	"tindak_lanjut" text,
	"penanggung_jawab_id" integer,
	"target_selesai" date,
	"selesai_pada" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "locations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"gedung" text NOT NULL,
	"lantai" text,
	"lokasi_tipe" text DEFAULT 'dalam_gedung' NOT NULL,
	"lat" numeric(10, 7),
	"lng" numeric(10, 7),
	"radius_m" smallint,
	"aktif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_gedung_lantai_unique" UNIQUE NULLS NOT DISTINCT("gedung","lantai")
);
--> statement-breakpoint
CREATE TABLE "qr_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "qr_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asset_id" integer NOT NULL,
	"token" varchar(64) NOT NULL,
	"aktif" boolean DEFAULT true NOT NULL,
	"dicabut_pada" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qr_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "schedules_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asset_id" integer NOT NULL,
	"periode" date NOT NULL,
	"jatuh_tempo" date NOT NULL,
	"petugas_id" integer,
	"inspection_id" integer,
	"status" text DEFAULT 'belum' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"nip" varchar(32) NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'inspektur' NOT NULL,
	"jabatan" text,
	"division_id" integer,
	"aktif" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_nip_unique" UNIQUE("nip"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_groups" ADD CONSTRAINT "checklist_groups_asset_type_id_asset_types_id_fk" FOREIGN KEY ("asset_type_id") REFERENCES "public"."asset_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_group_id_checklist_groups_id_fk" FOREIGN KEY ("checklist_group_id") REFERENCES "public"."checklist_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD CONSTRAINT "inspection_answers_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_answers" ADD CONSTRAINT "inspection_answers_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_photos" ADD CONSTRAINT "inspection_photos_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_qr_token_id_qr_tokens_id_fk" FOREIGN KEY ("qr_token_id") REFERENCES "public"."qr_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_ditinjau_oleh_users_id_fk" FOREIGN KEY ("ditinjau_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_followups" ADD CONSTRAINT "issue_followups_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_followups" ADD CONSTRAINT "issue_followups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_penanggung_jawab_id_users_id_fk" FOREIGN KEY ("penanggung_jawab_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_tokens" ADD CONSTRAINT "qr_tokens_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_petugas_id_users_id_fk" FOREIGN KEY ("petugas_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "assets_asset_type_id_kode_index" ON "assets" USING btree ("asset_type_id","kode");--> statement-breakpoint
CREATE INDEX "assets_asset_type_id_aktif_index" ON "assets" USING btree ("asset_type_id","aktif");--> statement-breakpoint
CREATE INDEX "assets_location_id_index" ON "assets" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entitas_entitas_id_index" ON "audit_logs" USING btree ("entitas","entitas_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_index" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "checklist_groups_asset_type_id_urut_index" ON "checklist_groups" USING btree ("asset_type_id","urut");--> statement-breakpoint
CREATE INDEX "checklist_items_checklist_group_id_urut_index" ON "checklist_items" USING btree ("checklist_group_id","urut");--> statement-breakpoint
CREATE UNIQUE INDEX "inspection_answers_inspection_id_checklist_item_id_index" ON "inspection_answers" USING btree ("inspection_id","checklist_item_id");--> statement-breakpoint
CREATE INDEX "inspection_photos_inspection_id_index" ON "inspection_photos" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "inspections_asset_id_inspected_at_index" ON "inspections" USING btree ("asset_id","inspected_at");--> statement-breakpoint
CREATE INDEX "inspections_gate_status_inspected_at_index" ON "inspections" USING btree ("gate_status","inspected_at");--> statement-breakpoint
CREATE INDEX "inspections_user_id_inspected_at_index" ON "inspections" USING btree ("user_id","inspected_at");--> statement-breakpoint
CREATE INDEX "issue_followups_issue_id_created_at_index" ON "issue_followups" USING btree ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "issues_asset_id_status_index" ON "issues" USING btree ("asset_id","status");--> statement-breakpoint
CREATE INDEX "issues_status_severity_index" ON "issues" USING btree ("status","severity");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_tokens_satu_aktif_per_aset" ON "qr_tokens" USING btree ("asset_id") WHERE "qr_tokens"."aktif";--> statement-breakpoint
CREATE UNIQUE INDEX "schedules_asset_id_periode_index" ON "schedules" USING btree ("asset_id","periode");--> statement-breakpoint
CREATE INDEX "schedules_periode_status_index" ON "schedules" USING btree ("periode","status");--> statement-breakpoint
CREATE INDEX "users_role_aktif_index" ON "users" USING btree ("role","aktif");