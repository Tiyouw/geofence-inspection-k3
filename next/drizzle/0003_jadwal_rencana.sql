ALTER TABLE "schedules" ADD COLUMN "tanggal_rencana" date;--> statement-breakpoint
CREATE INDEX "schedules_tanggal_rencana_index" ON "schedules" USING btree ("tanggal_rencana");