import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { harusMigrasi, hashMigrasi, migrasiTertunda, pernyataanBerisiko, tertundaTerlewati } from "../migrasi-deploy";

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
    expect(pernyataanBerisiko('DROP INDEX "a_b_idx";')).toEqual(["DROP"]);
    expect(pernyataanBerisiko('ALTER TABLE "a" ALTER COLUMN "b" DROP DEFAULT;')).toEqual(["DROP DEFAULT"]);
    expect(pernyataanBerisiko(`ALTER TYPE "public"."peran" ADD VALUE 'tamu';`)).toEqual(["ALTER TYPE ADD VALUE"]);
    expect(pernyataanBerisiko('UPDATE "inspections" SET "x" = 1;')).toEqual(["UPDATE data"]);
    // Penanda persetujuan hanya membuka UPDATE data; pola lain tetap ditolak.
    expect(pernyataanBerisiko(isi("0007_awalan_token_gik3"))).toEqual([]);
    expect(pernyataanBerisiko('-- migrasi-data-disetujui: uji\nUPDATE "a" SET "x" = 1; DELETE FROM "a";')).toEqual(["DELETE"]);
    expect(pernyataanBerisiko('-- migrasi-data-disetujui:\nUPDATE "a" SET "x" = 1;')).toEqual(["UPDATE data"]);
    expect(pernyataanBerisiko('INSERT INTO "settings" VALUES (1);')).toEqual(["INSERT data"]);
    expect(pernyataanBerisiko('CREATE TABLE "baru" ("id" serial); CREATE INDEX "baru_idx" ON "baru" ("id");')).toEqual([]);
  });

  it("migrasi tertunda yang when-nya tidak lebih baru dari yang terakhir tercatat ditandai (drizzle akan melewatinya)", () => {
    const j = [
      { idx: 0, tag: "0000_a", when: 100 },
      { idx: 1, tag: "0001_b", when: 300 },
      { idx: 2, tag: "0002_c", when: 200 },
    ];
    expect(tertundaTerlewati(j, ["0002_c"], 300)).toEqual(["0002_c"]);
    expect(tertundaTerlewati(j, ["0001_b"], 200)).toEqual([]);
    expect(tertundaTerlewati(j, ["0000_a"], null)).toEqual([]);
  });

  it("jurnal sekarang: when naik sesuai idx", () => {
    const urut = [...jurnal].sort((a, b) => a.idx - b.idx) as unknown as { when: number }[];
    for (let i = 1; i < urut.length; i++) expect(urut[i]!.when).toBeGreaterThan(urut[i - 1]!.when);
  });
});
