import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

test.describe("aset (H1-H3, C1, C7)", () => {
    test.beforeEach(async ({ page }) => {
        await masuk(page, "admin");
    });

    test("daftar aset merender dengan radius efektif dan filter yang saling menghormati", async ({ page }) => {
        await page.goto("/admin/aset");
        await expect(page.getByRole("heading", { name: "Aset & APAR" })).toBeVisible();
        await expect(page.getByRole("cell", { name: /m \(bawaan\)|tanpa gerbang|m \(khusus\)/ }).first()).toBeVisible();
        await page.goto("/admin/aset?gedung=Area%20Terbuka&tanpa_koordinat=1");
        // Seed: semua aset Area Terbuka berkoordinat, jadi gabungan filter kosong.
        await expect(page.getByText("Tidak ada aset yang cocok")).toBeVisible();
        // Token tidak tampil di tabel (C3).
        expect(await page.content()).not.toMatch(/PAL-K3-[0-9a-f]{32}/i);
    });

    test("formulir menolak koordinat tak sah, lalu menyimpan, mengubah, dan mengganti token", async ({ page }) => {
        const kode = `E2E-${Date.now().toString(36)}`;
        await page.goto("/admin/aset/baru");
        await expect(page.getByText("radius bawaan 75 m")).toBeVisible();
        await page.getByLabel("Jenis lokasi").selectOption("kendaraan");
        await expect(page.getByText("gerbang GPS tidak diberlakukan")).toBeVisible();
        await page.getByLabel("Jenis lokasi").selectOption("bengkel");
        await page.getByLabel("Nomor aset").fill(kode);
        await page.getByLabel("Uraian lokasi").fill("Uji otomatis dinding utara");
        await page.getByLabel("Lintang").fill("95");
        await page.getByLabel("Bujur").fill("112.7");
        await page.getByLabel("Radius khusus (m)").fill("3");
        await page.getByRole("button", { name: "Simpan aset" }).click();
        await expect(page.getByText("Lintang maksimal 90.")).toBeVisible();
        await expect(page.getByText("Radius khusus minimal 5.")).toBeVisible();

        await page.getByLabel("Lintang").fill("-7,2051");
        await page.getByLabel("Radius khusus (m)").fill("");
        await page.getByRole("button", { name: "Simpan aset" }).click();
        await expect(page).toHaveURL(/\/admin\/aset\/\d+$/);
        await expect(page.getByRole("heading", { name: `Aset ${kode}` })).toBeVisible();
        await expect(page.getByLabel("Terakhir dicek")).toHaveValue("Belum pernah");

        // Token baru acak dan tidak memuat nomor aset (C1); hanya tampil atas permintaan.
        expect(await page.content()).not.toMatch(/PAL-K3-[0-9a-f]{32}/i);
        await page.getByRole("button", { name: "Tampilkan token" }).click();
        const token1 = (await page.locator("code").textContent())!.trim();
        expect(token1).toMatch(/^PAL-K3-[0-9a-f]{32}$/);
        expect(token1).not.toContain(kode);

        // Ubah tanpa menyentuh token.
        await page.getByLabel("Gedung").fill("Gedung Uji");
        await page.getByRole("button", { name: "Simpan perubahan" }).click();
        await expect(page.getByText("Perubahan tersimpan.")).toBeVisible();

        // Nomor ganda untuk tipe yang sama ditolak dengan pesan ramah.
        await page.goto("/admin/aset/baru");
        await page.getByLabel("Nomor aset").fill(kode);
        await page.getByLabel("Uraian lokasi").fill("Duplikat");
        await page.getByRole("button", { name: "Simpan aset" }).click();
        await expect(page.getByText("Nomor aset ini sudah dipakai")).toBeVisible();
        await page.goBack();

        await page.goto(`/admin/aset?q=${kode}`);
        await page.getByRole("link", { name: kode }).click();
        await page.getByRole("button", { name: "Ganti token" }).click();
        await page.getByRole("button", { name: "Ya, ganti token" }).click();
        await expect(page.getByText("Stiker lama tidak berlaku lagi")).toBeVisible();
        await page.reload();
        await page.getByRole("button", { name: "Tampilkan token" }).click();
        const token2 = (await page.locator("code").textContent())!.trim();
        expect(token2).toMatch(/^PAL-K3-[0-9a-f]{32}$/);
        expect(token2).not.toBe(token1);
    });
});
