import { expect, test, type Browser } from "@playwright/test";
import { masuk } from "../helpers";
import { baris } from "./data";

async function cobaMasuk(browser: Browser, nip: string, sandi: string): Promise<string> {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/masuk");
    await page.getByLabel(/NIP/).fill(nip);
    await page.getByLabel("Kata sandi", { exact: true }).fill(sandi);
    await page.getByRole("button", { name: /^Masuk/ }).click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    const url = new URL(page.url()).pathname;
    await ctx.close();
    return url;
}

test.describe("pengguna (H8, A11, B7, B9)", () => {
    test("buat petugas → bisa masuk; ubah tanpa sandi mempertahankan sandi; sandi baru tampil sekali; nonaktif ditolak", async ({
        page,
        browser,
    }) => {
        const nip = `9${Date.now().toString().slice(-8)}`;
        await masuk(page, "admin");
        await page.goto("/admin/pengguna/baru");
        await page.getByLabel("NIP atau username").fill(nip);
        await page.getByLabel("Nama").fill("Petugas Uji E2E");
        await page.getByLabel("Kata sandi").fill("pendek");
        await page.getByRole("button", { name: "Simpan akun" }).click();
        await expect(page.getByText("Kata sandi minimal 8 karakter.")).toBeVisible();
        await expect(page.getByLabel("NIP atau username")).toHaveValue(nip);
        await page.getByLabel("Kata sandi").fill("sandi-uji-123");
        await page.getByRole("button", { name: "Simpan akun" }).click();
        await expect(page).toHaveURL(/\/admin\/pengguna\/\d+$/);
        expect(await cobaMasuk(browser, nip, "sandi-uji-123")).toBe("/petugas");

        // Ubah tanpa sandi: sandi lama tetap berlaku.
        await page.getByLabel("Jabatan").fill("Teknisi K3");
        await page.getByRole("button", { name: "Simpan perubahan" }).click();
        await expect(page.getByText("Perubahan tersimpan.")).toBeVisible();
        expect(await cobaMasuk(browser, nip, "sandi-uji-123")).toBe("/petugas");

        // NIP ganda ditolak dengan pesan ramah.
        await page.goto("/admin/pengguna/baru");
        await page.getByLabel("NIP atau username").fill(nip);
        await page.getByLabel("Nama").fill("Ganda");
        await page.getByLabel("Kata sandi").fill("sandi-uji-123");
        await page.getByRole("button", { name: "Simpan akun" }).click();
        await expect(page.getByText("NIP ini sudah terdaftar.")).toBeVisible();

        // Terbitkan sandi baru: tampil sekali, tersimpan sebagai hash.
        await page.goto(`/admin/pengguna?q=${nip}`);
        await page.getByRole("link", { name: "Petugas Uji E2E" }).click();
        await page.getByRole("button", { name: "Terbitkan sandi baru" }).click();
        await page.getByRole("button", { name: "Terbitkan" }).click();
        const sandi = (await page.getByLabel("Sandi baru", { exact: true }).textContent())!.trim();
        expect(sandi).toMatch(/^[A-Za-z0-9]{14}$/);
        await page.getByRole("button", { name: "Selesai" }).click();
        await expect(page.getByText(sandi)).toHaveCount(0);
        const [u] = await baris<{ password_hash: string }>("select password_hash from users where nip = $1", [nip]);
        expect(u!.password_hash).toMatch(/^\$2[aby]\$10\$/);
        expect(await cobaMasuk(browser, nip, "sandi-uji-123")).toBe("/masuk");
        expect(await cobaMasuk(browser, nip, sandi)).toBe("/petugas");
        const audit = await baris<{ data: unknown }>(
            "select data from audit_logs where aksi = 'pengguna.terbitkan_sandi' order by id desc limit 1",
        );
        expect(JSON.stringify(audit[0]!.data)).not.toContain(sandi);

        // Nonaktif: tidak bisa masuk.
        await page.goto(`/admin/pengguna?q=${nip}`);
        await page.getByRole("button", { name: "Nonaktifkan Petugas Uji E2E" }).click();
        await expect(page.getByText("Akun dinonaktifkan.")).toBeVisible();
        expect(await cobaMasuk(browser, nip, sandi)).toBe("/masuk");
    });

    test("admin tidak bisa mengubah peran atau menonaktifkan diri sendiri (B9)", async ({ page }) => {
        await masuk(page, "admin");
        await page.goto("/admin/pengguna?q=admin");
        await expect(page.getByRole("button", { name: /Nonaktifkan Administrator Demo/ })).toHaveCount(0);
        await page.getByRole("link", { name: "Administrator Demo" }).click();
        await expect(page.getByLabel("Peran")).toBeDisabled();
        await expect(page.getByLabel("Akun aktif")).toBeDisabled();
    });

    test("pemantau tidak bisa membuka pengelolaan petugas (B7)", async ({ page }) => {
        await masuk(page, "pemantau");
        await page.goto("/admin/pengguna");
        await expect(page).toHaveURL(/\/pemantau$/);
    });
});
