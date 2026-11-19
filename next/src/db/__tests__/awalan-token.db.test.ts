/**
 * Migrasi 0007 (ADR-17): token berawalan PAL-K3- menjadi GIK3- dengan isi heks yang sama;
 * token lain tidak disentuh. Dijalankan di dalam transaksi yang dibatalkan.
 * Dilewati bila DATABASE_URL tidak ada; di CI berjalan di job check (Postgres, sudah di-seed).
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adaDb = Boolean(process.env.DATABASE_URL);
const SQL = readFileSync(join(__dirname, "../../../drizzle/0007_awalan_token_gik3.sql"), "utf8");

describe.skipIf(!adaDb)("migrasi awalan token GIK3- (integrasi)", async () => {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  it("mengubah awalan lama, mempertahankan heks, dan idempoten", async () => {
    const c = await pool.connect();
    try {
      await c.query("begin");
      const { rows } = await c.query<{ id: number; qr_token: string }>("select id, qr_token from assets order by id limit 2");
      expect(rows).toHaveLength(2);
      const hex = "0123456789abcdef0123456789abcdef";
      await c.query("update assets set qr_token = $1 where id = $2", [`PAL-K3-${hex}`, rows[0]!.id]);
      const lain = rows[1]!.qr_token;
      await c.query(SQL);
      await c.query(SQL);
      const sesudah = await c.query<{ id: number; qr_token: string }>("select id, qr_token from assets where id = any($1) order by id", [
        rows.map((r) => r.id),
      ]);
      expect(sesudah.rows[0]!.qr_token).toBe(`GIK3-${hex}`);
      expect(sesudah.rows[1]!.qr_token).toBe(lain);
      const sisa = await c.query("select count(*)::int as n from assets where qr_token like 'PAL-K3-%'");
      expect(sisa.rows[0].n).toBe(0);
    } finally {
      await c.query("rollback");
      c.release();
      await pool.end();
    }
  });
});
