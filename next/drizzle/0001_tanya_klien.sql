CREATE TABLE "tanya_jawaban" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tanya_jawaban_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"formulir" varchar(32) NOT NULL,
	"nomor" varchar(8) NOT NULL,
	"jawaban" text DEFAULT '' NOT NULL,
	"pilihan" varchar(4),
	"pakai_bawaan" boolean DEFAULT false NOT NULL,
	"perlu_tanya" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tanya_kiriman" (
	"formulir" varchar(32) PRIMARY KEY NOT NULL,
	"dikirim_pada" timestamp with time zone DEFAULT now() NOT NULL,
	"jumlah_kirim" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tanya_lampiran" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"formulir" varchar(32) NOT NULL,
	"nomor" varchar(8) NOT NULL,
	"storage_key" text NOT NULL,
	"nama" text NOT NULL,
	"content_type" varchar(128) NOT NULL,
	"bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tanya_jawaban_formulir_nomor_index" ON "tanya_jawaban" USING btree ("formulir","nomor");--> statement-breakpoint
CREATE INDEX "tanya_lampiran_formulir_nomor_index" ON "tanya_lampiran" USING btree ("formulir","nomor");