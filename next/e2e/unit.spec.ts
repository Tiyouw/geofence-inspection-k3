import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { aset, tutup } from "./db-uji";
import { masuk } from "./helpers";

/**
 * PRD F2 / ADR-5: inspektur hanya menginspeksi aset milik unitnya, diperiksa di peladen.
 * Akun contoh 2004 = inspektur Divisi Matra & K3LH (pemilik kotak P3K); APAR milik SAT. PK.
 */
test.afterAll(tutup);

const SANDI = process.env.SEED_SANDI_AWAL;

test("inspektur unit lain: paket tanpa APAR dan start ditolak 403 dengan nama unit", async ({ page }) => {
  test.skip(!SANDI, "SEED_SANDI_AWAL kosong: sandi akun contoh acak");
  const a = await aset("01D");
  await page.goto("/masuk");
  await page.getByLabel(/NIP/).fill("2004");
  await page.getByLabel("Kata sandi", { exact: true }).fill(SANDI!);
  await page.getByRole("button", { name: /^Masuk/ }).click();
  await expect(page).toHaveURL(/\/petugas/, { timeout: 15_000 });

  const paket = await (await page.request.get("/api/field/bundle")).json();
  expect(paket.unit).toBe("Divisi Matra & K3LH");
  expect(paket.aset.some((x: { id: number }) => x.id === a.id)).toBe(false);
  expect(paket.asetUnitLain.length).toBeGreaterThan(0);

  const r = await page.request.post("/api/inspections/start", { data: { inspectionId: randomUUID(), token: a.token } });
  expect(r.status()).toBe(403);
  expect(await r.json()).toMatchObject({
    kode: "aset_unit_lain",
    pesan: "Aset ini milik SAT. PK. Anda hanya dapat menginspeksi aset Divisi Matra & K3LH.",
  });
});

test("inspektur SAT. PK: APAR ada di paket", async ({ page }) => {
  const a = await aset("01D");
  await masuk(page, "inspektur");
  const paket = await (await page.request.get("/api/field/bundle")).json();
  expect(paket.unit).toBe("SAT. PK");
  expect(paket.aset.some((x: { id: number }) => x.id === a.id)).toBe(true);
});
