import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { masuk } from "./helpers";

/** SPEC §3.6 / ACCEPTANCE F5: foto privat, terlihat oleh admin dan pemantau, tidak oleh tamu. */
let fotoId: string;

test.beforeAll(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query<{ id: string }>("select id from inspection_photos order by created_at limit 1");
  await pool.end();
  expect(rows[0], "seed harus membuat foto contoh").toBeTruthy();
  fotoId = rows[0]!.id;
});

test("tamu tidak bisa membuka URL foto", async ({ request }) => {
  const res = await request.get(`/api/foto/${fotoId}`, { maxRedirects: 0 });
  expect([401, 302, 307]).toContain(res.status());
});

for (const akun of ["admin", "pemantau"] as const) {
  test(`${akun} bisa melihat foto bukti`, async ({ page }) => {
    await masuk(page, akun);
    const res = await page.request.get(`/api/foto/${fotoId}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^image\//);
    expect(res.headers()["cache-control"]).toContain("private");
  });
}
