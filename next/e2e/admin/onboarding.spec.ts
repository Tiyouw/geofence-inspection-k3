import { expect, test, type Page } from "@playwright/test";
import { q } from "../db-uji";

/**
 * Onboarding varian B. Memakai akun contoh 1002 (admin) dan 3002 (pemantau) yang tidak dipakai uji
 * lain, supaya mengosongkan status onboarding-nya tidak mengganggu uji paralel.
 */
const SANDI = process.env.SEED_SANDI_AWAL;

async function masukSebagai(page: Page, nip: string) {
    await page.addInitScript(() => localStorage.setItem("onboarding-uji", "1"));
    await page.goto("/masuk");
    await page.getByLabel(/NIP/).fill(nip);
    await page.getByLabel("Kata sandi", { exact: true }).fill(SANDI!);
    await page.getByRole("button", { name: /^Masuk/ }).click();
    await expect(page).not.toHaveURL(/\/masuk(\?|$)/, { timeout: 15_000 });
}

test.describe("onboarding", () => {
    test.skip(!SANDI, "SEED_SANDI_AWAL kosong: sandi akun contoh acak");
    test.setTimeout(60_000);

    test("admin: sambutan, tur sampai selesai, tersimpan di server, ? membuka tur lagi", async ({ page }) => {
        await q(`update users set onboarding_selesai = '[]'::jsonb where nip = '1002'`);
        await masukSebagai(page, "1002");
        const sambut = page.getByRole("dialog", { name: "Selamat datang, Admin K3" });
        await expect(sambut).toBeVisible();
        await sambut.getByRole("button", { name: "Mulai tur" }).click();

        const tur = page.getByRole("dialog", { name: "Menu utama" });
        await expect(tur).toContainText("LANGKAH 1 DARI");
        for (let n = 0; n < 6; n++) {
            const selesai = page.getByRole("button", { name: "Selesai" });
            if (await selesai.isVisible()) break;
            await page.getByRole("button", { name: "Lanjut" }).click();
        }
        await expect(page.getByRole("dialog", { name: "Bantuan kapan saja" })).toBeVisible();
        await page.getByRole("button", { name: "Selesai" }).click();
        await expect.poll(async () => (await q<{ s: string[] }>(`select onboarding_selesai as s from users where nip = '1002'`))[0]?.s).toContain("admin");

        // Tidak muncul lagi setelah dimuat ulang.
        await page.reload();
        await expect(page.getByRole("dialog", { name: "Selamat datang, Admin K3" })).toHaveCount(0);

        // "?" di bilah samping membuka tur lagi.
        await page.getByRole("button", { name: "Bantuan & panduan" }).click();
        await page.getByRole("menuitem", { name: /Ulangi tur/ }).click();
        await expect(page.getByRole("dialog", { name: "Menu utama" })).toBeVisible();
        await page.getByRole("button", { name: "Lewati tur" }).click();
        await expect(page.getByRole("menuitem", { name: /Buka panduan lengkap/ })).toHaveCount(0);
    });

    test("pemantau: Jangan ingatkan saya lagi + Nanti saja tersimpan per akun", async ({ page }) => {
        await q(`update users set onboarding_selesai = '[]'::jsonb where nip = '3002'`);
        await masukSebagai(page, "3002");
        const sambut = page.getByRole("dialog", { name: "Selamat datang, Pemantau" });
        await expect(sambut).toBeVisible();
        await sambut.getByLabel("Jangan ingatkan saya lagi").check();
        await sambut.getByRole("button", { name: "Nanti saja" }).click();
        await expect(sambut).toHaveCount(0);
        await expect.poll(async () => (await q<{ s: string[] }>(`select onboarding_selesai as s from users where nip = '3002'`))[0]?.s).toContain("pemantau");
    });
});
