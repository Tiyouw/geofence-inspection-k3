import { expect, type Page } from "@playwright/test";

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
