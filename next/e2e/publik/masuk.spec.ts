import { expect, test } from "@playwright/test";
import { DEMO } from "../helpers";

const PERAN = [
    ["admin", "Administrator", "Membuka Panel Admin…", /\/admin$/],
    ["pemantau", "Pemantau", "Membuka Papan Pantau…", /\/pemantau$/],
    ["inspektur", "Inspektur", "Membuka Aplikasi Petugas…", /\/petugas$/],
] as const;

test.describe("satu pintu masuk dengan deteksi peran", () => {
    for (const [akun, label, , tujuan] of PERAN) {
        test(`${akun}: peran terdeteksi lalu tiba di halamannya`, async ({ page }) => {
            await page.goto("/masuk");
            await page.getByLabel(/NIP/).fill(DEMO[akun].nip);
            await page.getByLabel("Kata sandi", { exact: true }).fill(DEMO[akun].password);
            await page.getByRole("button", { name: /^Masuk/ }).click();
            await expect(page.getByRole("status").filter({ hasText: "Peran terdeteksi" })).toContainText(label);
            await expect(page).toHaveURL(tujuan, { timeout: 15_000 });
        });
    }

    test("sandi salah tampil di formulir tanpa animasi peran", async ({ page }) => {
        await page.goto("/masuk");
        await page.getByLabel(/NIP/).fill(`uji-${Date.now()}`);
        await page.getByLabel("Kata sandi", { exact: true }).fill("salah-sekali");
        await page.getByRole("button", { name: /^Masuk/ }).click();
        await expect(page.locator("#galat-masuk")).toContainText("NIP atau kata sandi tidak cocok");
        await expect(page.getByText("Peran terdeteksi")).toHaveCount(0);
        await expect(page.getByLabel(/NIP/)).toHaveValue(/^uji-/);
        await expect(page).toHaveURL(/\/masuk$/);
    });

    test("gerak dikurangi: langsung ke halaman peran tanpa animasi", async ({ browser }) => {
        const ctx = await browser.newContext({ reducedMotion: "reduce" });
        const page = await ctx.newPage();
        let terlihat = false;
        await page.goto("/masuk");
        await page.getByLabel(/NIP/).fill(DEMO.admin.nip);
        await page.getByLabel("Kata sandi", { exact: true }).fill(DEMO.admin.password);
        const pengamat = page
            .getByText("Peran terdeteksi")
            .waitFor({ timeout: 10_000 })
            .then(() => (terlihat = true))
            .catch(() => {});
        await page.getByRole("button", { name: /^Masuk/ }).click();
        await expect(page).toHaveURL(/\/admin$/, { timeout: 15_000 });
        await Promise.race([pengamat, page.waitForTimeout(200)]);
        expect(terlihat).toBe(false);
        await ctx.close();
    });

    test("callbackUrl tetap dihormati setelah animasi", async ({ page }) => {
        await page.goto(`/masuk?callbackUrl=${encodeURIComponent("/admin/aset")}`);
        await page.getByLabel(/NIP/).fill(DEMO.admin.nip);
        await page.getByLabel("Kata sandi", { exact: true }).fill(DEMO.admin.password);
        await page.getByRole("button", { name: /^Masuk/ }).click();
        await expect(page).toHaveURL(/\/admin\/aset$/, { timeout: 15_000 });
    });
});
