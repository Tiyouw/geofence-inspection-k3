import { expect, test, type APIResponse } from "@playwright/test";
import { masuk } from "../helpers";

/**
 * PRD "Laporan" untuk modul Kotak P3K dan Hydrant: PMS per modul, rekap isi P3K, kartu kontrol.
 * Memakai data seed (10 kotak P3K, 7 hydrant box, 5 pilar, inspeksi contoh bulan ini).
 */
const bulanIni = () => {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  return { tahun: iso.slice(0, 4), bulan: iso.slice(5, 7) };
};

async function harusPdf(res: APIResponse, nama: RegExp) {
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect(res.headers()["content-disposition"]).toMatch(nama);
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
}

test.beforeEach(async ({ page }) => {
  await masuk(page, "pemantau");
});

test("laporan Kotak P3K: tautan rekap isi P3K, PMS, dan kartu kontrol menghasilkan PDF", async ({ page }) => {
  const { tahun, bulan } = bulanIni();
  await page.goto(`/pemantau/laporan?tipe=p3k&tahun=${tahun}&bulan=${Number(bulan)}`);
  await expect(page.getByText("P3K-01", { exact: true })).toBeVisible();
  const rekap = page.getByRole("link", { name: /Rekap isi P3K/ });
  await expect(rekap).toBeVisible();
  await harusPdf(await page.request.get((await rekap.getAttribute("href"))!), new RegExp(`filename="Rekap-Isi-P3K-${tahun}-${bulan}\\.pdf"`));
  await harusPdf(await page.request.get(`/laporan/pms?tipe=p3k&tahun=${tahun}&bulan=${bulan}`), new RegExp(`filename="PMS-P3K-${tahun}-${bulan}\\.pdf"`));
  const kartu = page.getByRole("row", { name: /P3K-01/ }).getByRole("link").last();
  await harusPdf(await page.request.get((await kartu.getAttribute("href"))!), /filename="Kartu-Kontrol-P3K-01-/);
});

test("laporan hydrant box dan pilar: PMS per tipe; rekap isi P3K tidak ditawarkan", async ({ page }) => {
  const { tahun, bulan } = bulanIni();
  for (const [slug, kode] of [
    ["hydrant_box", "HB-01"],
    ["hydrant_pilar", "HP-01"],
  ] as const) {
    await page.goto(`/pemantau/laporan?tipe=${slug}&tahun=${tahun}&bulan=${Number(bulan)}`);
    await expect(page.getByText(kode, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Rekap isi P3K/ })).toHaveCount(0);
    await harusPdf(
      await page.request.get(`/laporan/pms?tipe=${slug}&tahun=${tahun}&bulan=${bulan}`),
      new RegExp(`filename="PMS-${slug.toUpperCase()}-${tahun}-${bulan}\\.pdf"`),
    );
  }
});

test("rekap isi P3K: filter tidak sah ditolak, inspektur tidak berhak", async ({ page, browser }) => {
  expect((await page.request.get("/laporan/isi-p3k?bulan=13")).status()).toBe(422);
  const lain = await browser.newPage();
  await masuk(lain, "inspektur");
  const res = await lain.request.get("/laporan/isi-p3k", { maxRedirects: 0 });
  expect([302, 303, 307, 401, 403]).toContain(res.status());
  await lain.close();
});
