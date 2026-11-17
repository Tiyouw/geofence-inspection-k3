import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

test("inspektur masuk ke beranda petugas di ponsel", async ({ page }) => {
  await masuk(page, "inspektur");
  await expect(page).toHaveURL(/\/petugas$/);
  await expect(page.getByRole("link", { name: /Pindai QR APAR/ })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu petugas" })).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/petugas$/);
});

test("manifest PWA tersedia", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.short_name).toBe("Geofencing");
  expect(m.lang).toBe("id");
});
