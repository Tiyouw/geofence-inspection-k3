import { expect, test } from "@playwright/test";
import { masuk } from "./helpers";

test("tamu diarahkan ke /masuk dari area terlindung", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/masuk\?callbackUrl=/);
  await expect(page.getByRole("heading", { name: "Siap menjaga keselamatan?" })).toBeVisible();
});

test("sandi salah ditolak dengan pesan", async ({ page }) => {
  await page.goto("/masuk");
  // NIP acak: percobaan gagal dihitung per NIP, jadi akun demo tidak ikut terkunci.
  await page.getByLabel(/NIP/).fill(`uji-${Date.now()}`);
  await page.getByLabel("Kata sandi", { exact: true }).fill("salah-sekali");
  await page.getByRole("button", { name: /^Masuk/ }).click();
  await expect(page.locator("#galat-masuk")).toContainText("NIP atau kata sandi tidak cocok");
  await expect(page).toHaveURL(/\/masuk/);
});

test("admin masuk ke /admin dan bisa membuka /pemantau", async ({ page }) => {
  await masuk(page, "admin");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1, name: /^Ringkasan / })).toBeVisible();
  await page.goto("/pemantau");
  await expect(page.getByRole("heading", { name: "Papan pantau" })).toBeVisible();
  await page.goto("/petugas");
  await expect(page).toHaveURL(/\/admin$/);
});

test("pemantau tidak bisa membuka /admin", async ({ page }) => {
  await masuk(page, "pemantau");
  await expect(page).toHaveURL(/\/pemantau$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/pemantau$/);
});

test("callbackUrl dipakai setelah masuk", async ({ page }) => {
  await masuk(page, "admin", "/admin/aset");
  await expect(page).toHaveURL(/\/admin\/aset$/);
});

test("keluar mengakhiri sesi", async ({ page }) => {
  await masuk(page, "pemantau");
  // Tunggu papan selesai dirender: navigasi yang masih berjalan bisa menimpa pengalihan aksi keluar.
  await expect(page.getByText("Ringkasan untuk manajemen")).toBeVisible();
  // Dialog konfirmasi: batal tetap di dalam, lanjut keluar.
  await page.getByRole("button", { name: "Keluar" }).first().click();
  const dialog = page.getByRole("alertdialog", { name: "Keluar dari akun?" });
  await dialog.getByRole("button", { name: "Tetap masuk" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/pemantau/);
  await page.getByRole("button", { name: "Keluar" }).first().click();
  await dialog.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page).toHaveURL(/\/masuk/);
  await expect(page.getByRole("status").filter({ hasText: "Anda sudah keluar." })).toBeVisible();
  await page.goto("/pemantau");
  await expect(page).toHaveURL(/\/masuk/);
});

test("lima percobaan gagal mengunci NIP itu 60 detik", async ({ page }) => {
  const nip = `kunci-${Date.now()}`;
  await page.goto("/masuk");
  for (let i = 0; i < 6; i++) {
    await page.getByLabel(/NIP/).fill(nip);
    await page.getByLabel("Kata sandi", { exact: true }).fill("salah");
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/masuk")),
      page.getByRole("button", { name: /^Masuk/ }).click(),
    ]);
    await expect(page.locator("#galat-masuk")).toBeVisible();
  }
  await expect(page.locator("#galat-masuk")).toContainText(/Terlalu banyak percobaan\. Coba lagi dalam \d+ detik\./);
});
