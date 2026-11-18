import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { harusMigrasi, hashMigrasi, migrasiTertunda, pernyataanBerisiko } from "../migrasi-deploy";

const FOLDER = join(__dirname, "../../../drizzle");
const jurnal = JSON.parse(readFileSync(join(FOLDER, "meta/_journal.json"), "utf8")).entries as { idx: number; tag: string }[];
const isi = (tag: string) => readFileSync(join(FOLDER, `${tag}.sql`), "utf8");

describe("migrasi saat deploy (insiden 18 Nov: 0003 tidak dijalankan di dev)", () => {
  it("hanya berjalan di build produksi Vercel yang punya URL basis data", () => {
    expect(harusMigrasi({ VERCEL: "1", VERCEL_ENV: "production", DATABASE_URL_UNPOOLED: "postgres://x" })).toBe(true);
    expect(harusMigrasi({ VERCEL: "1", VERCEL_ENV: "preview", DATABASE_URL: "postgres://x" })).toBe(false);
    expect(harusMigrasi({ CI: "true", DATABASE_URL: "postgres://x" })).toBe(false);
    expect(harusMigrasi({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(false);
  });

  it("migrasi yang hash-nya belum tercatat dianggap tertunda, urut jurnal", () => {
    const tercatat = new Set(jurnal.slice(0, -1).map((e) => hashMigrasi(isi(e.tag))));
    expect(migrasiTertunda(jurnal, isi, tercatat)).toEqual([jurnal.at(-1)!.tag]);
    expect(migrasiTertunda(jurnal, isi, new Set(jurnal.map((e) => hashMigrasi(isi(e.tag)))))).toEqual([]);
  });

  it("setiap entri jurnal punya berkas SQL, dan setiap berkas SQL ada di jurnal", () => {
    const berkas = readdirSync(FOLDER).filter((f) => f.endsWith(".sql")).map((f) => f.replace(/\.sql$/, ""));
    expect(new Set(berkas)).toEqual(new Set(jurnal.map((e) => e.tag)));
  });

  it("pernyataan tidak aditif ditolak; menambah kolom nullable dan indeks aman", () => {
    expect(pernyataanBerisiko(isi("0003_jadwal_rencana"))).toEqual([]);
    expect(pernyataanBerisiko('ALTER TABLE "a" DROP COLUMN "b";')).toEqual(["DROP"]);
    expect(pernyataanBerisiko('ALTER TABLE "a" RENAME COLUMN "b" TO "c";')).toEqual(["RENAME"]);
    expect(pernyataanBerisiko('ALTER TABLE "a" ALTER COLUMN "b" SET DATA TYPE integer;')).toEqual(["ubah tipe kolom"]);
    expect(pernyataanBerisiko('ALTER TABLE "a" ALTER COLUMN "b" SET NOT NULL;')).toEqual(["SET NOT NULL"]);
  });
});
