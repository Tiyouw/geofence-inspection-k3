import { expect, type Locator, type Page } from "@playwright/test";

export const DEMO = {
  admin: { nip: "admin", password: process.env.DEMO_ADMIN_PASSWORD || "admin123" },
  pemantau: { nip: "pemantau", password: process.env.DEMO_PEMANTAU_PASSWORD || "pemantau123" },
  inspektur: { nip: "inspektur", password: process.env.DEMO_INSPEKTUR_PASSWORD || "inspektur123" },
} as const;

export async function masuk(page: Page, akun: keyof typeof DEMO, callbackUrl?: string) {
  await page.goto(callbackUrl ? `/masuk?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/masuk");
  await page.getByLabel(/NIP/).fill(DEMO[akun].nip);
  await page.getByLabel("Kata sandi", { exact: true }).fill(DEMO[akun].password);
  await page.getByRole("button", { name: /^Masuk/ }).click();
  await expect(page).not.toHaveURL(/\/masuk/, { timeout: 15_000 });
}

/**
 * Memilih di kontrol Pilihan (pengganti <select> asli): buka pemicu, lalu klik pilihan menurut
 * teksnya, atau urutannya bila `opsi` angka.
 */
export async function pilih(pemicu: Locator, opsi: string | RegExp | number) {
  await pemicu.click();
  const daftar = pemicu.page().getByRole("listbox").last();
  await expect(daftar).toBeVisible();
  const item =
    typeof opsi === "number"
      ? daftar.getByRole("option").nth(opsi)
      : daftar.getByRole("option", { name: opsi, exact: typeof opsi === "string" });
  await item.click();
  await expect(daftar).toBeHidden();
}

/** Menyetujui dialog konfirmasi aplikasi (pengganti window.confirm) dengan tombol lanjutnya. */
export async function setujuiDialog(page: Page, tombol?: string | RegExp) {
  const dialog = page.getByTestId("dialog-konfirmasi");
  await expect(dialog).toBeVisible();
  if (tombol) await dialog.getByRole("button", { name: tombol }).click();
  else await dialog.getByRole("button").last().click();
  await expect(dialog).toBeHidden();
}
