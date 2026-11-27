import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

/** Kalender jadwal (redesain A): jadwalkan lewat papan ketik, pindah tampilan, lepas dari jadwal. */
test.describe("kalender jadwal", () => {
    test.beforeEach(async ({ page }) => {
        await masuk(page, "admin");
    });

    test("jadwalkan kelompok tanpa seret, lalu lepas lagi", async ({ page }) => {
        await page.goto("/admin/jadwal");
        await expect(page.getByRole("heading", { level: 1, name: "Jadwal", exact: true })).toBeVisible();
        const belum = page.getByRole("complementary", { name: /^Belum dijadwalkan/ });
        const tombol = belum.getByRole("button", { name: /^Jadwalkan / }).first();
        const nama = (await tombol.getAttribute("aria-label"))!.replace(/^Jadwalkan /, "");
        await tombol.click();

        const dialog = page.getByRole("dialog", { name: "Jadwalkan pemeriksaan" });
        await expect(dialog.getByLabel("Tanggal pemeriksaan")).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
        await dialog.getByRole("button", { name: "Simpan tanggal" }).click();
        await expect(page.getByText(/dijadwalkan \d+ \w+\./).first()).toBeVisible();

        // Kartu tampil di kalender; membukanya memberi jalan papan ketik untuk memindah atau melepas.
        const [jenis] = nama.split(" ");
        const kartu = page.getByRole("grid").getByRole("button", { name: new RegExp(`^${jenis}`) }).first();
        await expect(kartu).toBeVisible();
        await kartu.click();
        const ubah = page.getByRole("dialog", { name: "Ubah tanggal pemeriksaan" });
        await expect(ubah).toBeVisible();
        await ubah.getByRole("button", { name: "Lepas dari jadwal" }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Lepas" }).click();
        await expect(page.getByText(/dikembalikan ke daftar belum dijadwalkan/)).toBeVisible();
    });

    test("tampilan minggu dan kembali ke hari ini", async ({ page }) => {
        await page.goto("/admin/jadwal");
        await page.getByRole("tab", { name: "Minggu" }).click();
        await expect(page).toHaveURL(/lihat=minggu/);
        await expect(page.getByRole("gridcell")).toHaveCount(7);
        await page.getByRole("link", { name: "Minggu berikutnya" }).click();
        await page.getByRole("link", { name: "Hari ini" }).click();
        await expect(page.getByRole("gridcell")).toHaveCount(7);
        await page.getByRole("tab", { name: "Bulan" }).click();
        await expect(page).not.toHaveURL(/lihat=minggu/);
    });

    test("tanggal di luar periode tidak bisa disimpan", async ({ page }) => {
        await page.goto("/admin/jadwal");
        const tombol = page.getByRole("complementary", { name: /^Belum dijadwalkan/ }).getByRole("button", { name: /^Jadwalkan / }).first();
        await tombol.click();
        const dialog = page.getByRole("dialog", { name: "Jadwalkan pemeriksaan" });
        await dialog.getByLabel("Tanggal pemeriksaan").fill("2001-01-01");
        await expect(dialog.getByText("Pilih tanggal di dalam periodenya.")).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Simpan tanggal" })).toBeDisabled();
    });
});
