import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

test.describe("panel admin (H1, K1-K6, G11)", () => {
    test.beforeEach(async ({ page }) => {
        await masuk(page, "admin");
    });

    test("setiap daftar dan formulir buat merender", async ({ page }) => {
        for (const [url, judul] of [
            ["/admin/aset", "Aset"],
            ["/admin/aset/baru", "Tambah aset"],
            ["/admin/tinjauan?tab=semua", "Tinjauan inspeksi"],
            ["/admin/temuan", "Temuan"],
            ["/admin/pengguna", "Pengguna"],
            ["/admin/pengguna/baru", "Tambah petugas"],
            ["/admin/jadwal", "Jadwal"],
            ["/admin/lokasi", "Lokasi & area"],
            ["/admin/checklist", "Checklist"],
            ["/admin/audit", "Riwayat perubahan"],
        ] as const) {
            const res = await page.goto(url);
            expect(res?.status(), url).toBe(200);
            await expect(page.getByRole("heading", { level: 1, name: judul, exact: true })).toBeVisible();
            if (url === "/admin/jadwal") await expect(page.getByText("tiap 30 hari").first()).toBeVisible();
        }
    });

    test("jadwal: label status dan ubah periode tipe", async ({ page }) => {
        await page.goto("/admin/jadwal?tampil=daftar");
        await expect(page.getByRole("cell", { name: /Terlaksana|Belum|Terlewat/ }).first()).toBeVisible();
        const hidrant = page.getByRole("listitem").filter({ hasText: "Hydrant Pilar" });
        await hidrant.getByRole("button", { name: "Ubah" }).click();
        await page.getByLabel("Periode (hari)").fill("30");
        await page.getByRole("button", { name: "Simpan" }).click();
        await expect(page.getByText("Periode inspeksi tersimpan.")).toBeVisible();
    });

    test("Ctrl+K: saran saat kosong, pencarian aset tanpa token, wildcard aman", async ({ page }) => {
        await page.goto("/admin/aset");
        // `/` tidak dibajak: tidak membuka pencarian.
        await page.keyboard.press("/");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.keyboard.press("Control+k");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText("Halaman")).toBeVisible();
        await expect(dialog.getByText("Tambah aset")).toBeVisible();
        await page.getByRole("combobox", { name: "Kata pencarian" }).fill("01D");
        await expect(dialog.getByRole("option", { name: /^01D · / })).toBeVisible();
        expect(await dialog.innerHTML()).not.toMatch(/GIK3-[0-9a-f]{32}/i);
        await page.getByRole("combobox", { name: "Kata pencarian" }).fill("%_");
        await expect(dialog.getByText("Tidak ada hasil.")).toBeVisible();
        await page.getByRole("combobox", { name: "Kata pencarian" }).fill("01D");
        await dialog.getByRole("option", { name: /^01D · / }).click();
        await expect(page).toHaveURL(/\/admin\/aset\/\d+$/);
    });
});
