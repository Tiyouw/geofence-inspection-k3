import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

/**
 * Bug 19 Nov 2026 (ponsel pemilik): Profil → Keluar tidak melakukan apa-apa. Service worker
 * menyimpan koneksi IndexedDB akun yang tidak pernah ditutup, sehingga deleteDB di jendela
 * tertahan selamanya dan aksi keluar tidak pernah dipanggil.
 */
test("inspektur keluar dari Profil walau service worker memegang basis data akun", async ({ page }) => {
  await masuk(page, "inspektur");
  await expect(page.getByTestId("progres")).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 }).catch(async () => {
    await page.reload();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  });
  // Buat service worker membuka (dan menahan) koneksi basis data akun, seperti Background Sync.
  await page.evaluate(() => navigator.serviceWorker.controller!.postMessage({ jenis: "kuras" }));
  await page.waitForTimeout(1500);

  await page.goto("/petugas/profil");
  await page.getByRole("button", { name: "Keluar" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Keluar dari akun?" });
  await expect(dialog).toContainText("dihapus");
  await dialog.getByRole("button", { name: /^Keluar/ }).click();
  await expect(page).toHaveURL(/\/masuk/, { timeout: 10_000 });
  // Basis data akun benar-benar terhapus (koneksi service worker dilepas, bukan tertahan).
  await expect
    .poll(() => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name).filter((n) => n?.startsWith("pal-k3:"))), { timeout: 10_000 })
    .toEqual([]);
});
