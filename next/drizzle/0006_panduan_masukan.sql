CREATE TABLE "masukan_panduan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" varchar(80) NOT NULL,
	"jenis" varchar(16) NOT NULL,
	"konteks" varchar(160) DEFAULT '' NOT NULL,
	"langkah" varchar(64),
	"isi" text NOT NULL,
	"storage_key" text,
	"content_type" varchar(64),
	"bytes" integer,
	"pengirim_hash" varchar(64) NOT NULL,
	"user_agent" varchar(300),
	"selesai" boolean DEFAULT false NOT NULL,
	"selesai_pada" timestamp with time zone,
	"selesai_oleh" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "mode_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "masukan_panduan" ADD CONSTRAINT "masukan_panduan_selesai_oleh_users_id_fk" FOREIGN KEY ("selesai_oleh") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "masukan_panduan_selesai_created_at_index" ON "masukan_panduan" USING btree ("selesai","created_at");--> statement-breakpoint
CREATE INDEX "masukan_panduan_pengirim_hash_created_at_index" ON "masukan_panduan" USING btree ("pengirim_hash","created_at");