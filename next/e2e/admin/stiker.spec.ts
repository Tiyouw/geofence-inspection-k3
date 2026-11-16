import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

const MM = 96 / 25.4;

test.describe("lembar stiker QR (L7, C3, B10)", () => {
  test("tiga tata letak dengan ukuran mm tepat, filter kode, navigasi tersembunyi saat cetak", async ({ page }) => {
    await masuk(page, "admin");
    for (const [tata, lebar, tinggi, per] of [
      ["3x8", 63.5, 33.9, 24],
      ["2x5", 99.1, 57, 10],
      ["2x4", 99.1, 67.7, 8],
    ] as const) {
      await page.goto(`/stiker?tata=${tata}`);
      const label = page.locator(".stiker-label").first();
      const box = (await label.boundingBox())!;
      expect(Math.abs(box.width - lebar * MM)).toBeLessThan(1);
      expect(Math.abs(box.height - tinggi * MM)).toBeLessThan(1);
      const isiLembar = await page.locator(".stiker-lembar").first().locator(".stiker-label").count();
      expect(isiLembar).toBeLessThanOrEqual(per);
    }

    await page.goto("/stiker?kode=01D,%2002D");
    await expect(page.locator(".stiker-label")).toHaveCount(2);
    const token = (await page.locator(".stiker-token").first().textContent())!.trim();
    expect(token).toMatch(/^PAL-K3-[0-9a-f]{32}$/);
    await expect(page.locator(".stiker-qr svg").first()).toBeVisible();

    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("navigation", { name: "Pindah halaman pengelolaan" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Terapkan" })).toBeHidden();
  });

  for (const akun of ["pemantau", "inspektur"] as const) {
    test(`${akun} tidak bisa membuka lembar stiker`, async ({ page }) => {
      await masuk(page, akun);
      await page.goto("/stiker");
      await expect(page).not.toHaveURL(/\/stiker/);
      expect(await page.content()).not.toMatch(/PAL-K3-[0-9a-f]{32}/i);
    });
  }
});
