import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

test.describe("tombol mata pada kolom sandi", () => {
    test("masuk: tampilkan/sembunyikan dengan klik dan papan ketik", async ({ page }) => {
        await page.goto("/masuk");
        const sandi = page.getByLabel("Kata sandi", { exact: true });
        await sandi.fill("rahasia-123");
        await expect(sandi).toHaveAttribute("type", "password");

        const tampilkan = page.getByRole("button", { name: "Tampilkan sandi" });
        await expect(tampilkan).toHaveAttribute("aria-pressed", "false");
        await tampilkan.click();
        await expect(sandi).toHaveAttribute("type", "text");
        const sembunyikan = page.getByRole("button", { name: "Sembunyikan sandi" });
        await expect(sembunyikan).toHaveAttribute("aria-pressed", "true");

        // Papan ketik: Tab dari kolom sandi ke tombol mata, lalu Spasi/Enter.
        await sandi.focus();
        await page.keyboard.press("Tab");
        await expect(sembunyikan).toBeFocused();
        await page.keyboard.press("Space");
        await expect(sandi).toHaveAttribute("type", "password");
        await expect(page.getByRole("button", { name: "Tampilkan sandi" })).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(sandi).toHaveAttribute("type", "text");
        await expect(sandi).toHaveValue("rahasia-123");
    });

    test("admin: kolom sandi petugas baru punya tombol mata", async ({ page }) => {
        await masuk(page, "admin");
        await page.goto("/admin/pengguna/baru");
        const sandi = page.getByLabel("Kata sandi", { exact: true });
        await sandi.fill("sandi-uji-123");
        await expect(sandi).toHaveAttribute("type", "password");
        await page.getByRole("button", { name: "Tampilkan sandi" }).click();
        await expect(sandi).toHaveAttribute("type", "text");
        await page.getByRole("button", { name: "Sembunyikan sandi" }).click();
        await expect(sandi).toHaveAttribute("type", "password");
    });
});

/** Durasi gerak terhitung (detik) pada elemen, dari CSS yang benar-benar berlaku. */
const durasi = (el: Element, sifat: string) =>
    Math.max(...getComputedStyle(el)[sifat as "animationDuration" | "transitionDuration"].split(",").map((d) => parseFloat(d) * (d.trim().endsWith("ms") ? 0.001 : 1)));

test.describe("gerak halus dan gerak dikurangi", () => {
    test("biasa: dialog dan galat memakai token gerak (180–320 ms)", async ({ page }) => {
        await masuk(page, "admin");
        await page.goto("/admin/pengguna/baru");
        await page.getByRole("button", { name: "Simpan akun" }).click();
        const galat = page.locator("#nip-galat");
        await expect(galat).toBeVisible();
        const wadah = page.locator('[data-slot="pesan-muncul"][data-buka]').first();
        const t = await wadah.evaluate(durasi, "transitionDuration");
        expect(t).toBeGreaterThanOrEqual(0.18);
        expect(t).toBeLessThanOrEqual(0.32);

        await page.goto("/admin");
        await page.keyboard.press("Control+k");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        const a = await dialog.evaluate(durasi, "animationDuration");
        expect(a).toBeGreaterThanOrEqual(0.18);
        expect(a).toBeLessThanOrEqual(0.32);
    });

    test("gerak dikurangi: animasi dan transisi praktis nol", async ({ browser }) => {
        const ctx = await browser.newContext({ reducedMotion: "reduce" });
        const page = await ctx.newPage();
        await masuk(page, "admin");
        await page.goto("/admin/pengguna/baru");
        await page.getByRole("button", { name: "Simpan akun" }).click();
        await expect(page.locator("#nip-galat")).toBeVisible();
        const wadah = page.locator('[data-slot="pesan-muncul"][data-buka]').first();
        expect(await wadah.evaluate(durasi, "transitionDuration")).toBeLessThan(0.01);

        await page.keyboard.press("Control+k");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        expect(await dialog.evaluate(durasi, "animationDuration")).toBeLessThan(0.01);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);

        const ikon = page.locator('[data-slot="input-sandi"] svg').first();
        await page.goto("/admin/pengguna/baru");
        expect(await ikon.evaluate(durasi, "transitionDuration")).toBeLessThan(0.01);
        await ctx.close();
    });
});
