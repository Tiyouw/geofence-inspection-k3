import { expect, test } from "@playwright/test";
import { masuk, pilih } from "../helpers";

test.describe("aset (H1-H3, C1, C7)", () => {
    test.beforeEach(async ({ page }) => {
        await masuk(page, "admin");
    });

    test("daftar aset merender dengan area dan filter yang saling menghormati", async ({ page }) => {
        await page.goto("/admin/aset");
        await expect(page.getByRole("heading", { name: "Aset & APAR" })).toBeVisible();
        await expect(page.getByRole("columnheader", { name: "Area" })).toBeVisible();
        await expect(page.getByRole("cell", { name: "Gedung PIP" }).first()).toBeVisible();
        await page.goto("/admin/aset?gedung=Area%20Terbuka&tanpa_koordinat=1");
        // Seed: semua aset Area Terbuka berkoordinat, jadi gabungan filter kosong.
        await expect(page.getByText("Tidak ada aset yang cocok")).toBeVisible();
        // Token tidak tampil di tabel (C3).
        expect(await page.content()).not.toMatch(/PAL-K3-[0-9a-f]{32}/i);
    });

    test("bilah Filter: Area 'Belum berarea' dan koordinat; Pilihan dapat dipakai dengan papan ketik", async ({ page }) => {
        await page.goto("/admin/aset");
        const filter = page.getByRole("search", { name: "Filter" });
        await expect(filter.getByRole("heading", { name: "Filter" })).toBeVisible();
        await pilih(filter.getByRole("combobox", { name: "Area", exact: true }), /^Belum berarea \(\d+\)$/);
        await filter.getByRole("button", { name: "Terapkan filter" }).click();
        await expect(page).toHaveURL(/area=belum/);
        await expect(page.getByRole("list", { name: "Filter aktif" })).toContainText("Area: Belum berarea");
        // Hanya aset bertitik tetap tanpa area: setiap baris berlabel "Belum berarea", atau tabel kosong.
        const sel = page.locator("tbody tr td:nth-child(3)");
        if (await sel.count()) expect((await sel.allInnerTexts()).every((t) => t.trim() === "Belum berarea")).toBe(true);
        else await expect(page.getByText("Tidak ada aset yang cocok dengan filter.")).toBeVisible();

        // Papan ketik: fokus pemicu, panah bawah membuka, Enter memilih, Esc tidak mengirim.
        await page.goto("/admin/aset");
        const status = page.getByRole("search", { name: "Filter" }).getByRole("combobox", { name: "Status", exact: true });
        await status.focus();
        await page.keyboard.press("ArrowDown");
        await expect(page.getByRole("listbox")).toBeVisible();
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
        await expect(page.getByRole("listbox")).toBeHidden();
        await expect(status).toHaveAttribute("data-nilai", "ya");
        await page.getByRole("button", { name: "Terapkan filter" }).click();
        await expect(page).toHaveURL(/aktif=ya/);
    });

    test("formulir menolak koordinat tak sah, lalu menyimpan, mengubah, dan mengganti token", async ({ page }) => {
        const kode = `E2E-${Date.now().toString(36)}`;
        await page.goto("/admin/aset/baru");
        await expect(page.getByLabel("Radius khusus (m)")).toHaveCount(0);
        await pilih(page.getByRole("combobox", { name: "Area", exact: true }), "Gedung PIP");
        await page.getByLabel("Nomor aset").fill(kode);
        await page.getByLabel("Uraian lokasi").fill("Uji otomatis dinding utara");
        await page.getByLabel("Lintang").fill("95");
        await page.getByLabel("Bujur").fill("112.7");
        await page.getByRole("button", { name: "Simpan aset" }).click();
        await expect(page.getByText("Lintang maksimal 90.")).toBeVisible();

        await page.getByLabel("Lintang").fill("-7,2051");
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
        await expect(page.getByRole("combobox", { name: "Area", exact: true })).toHaveAttribute("data-nilai", /\d+/);
        await pilih(page.getByRole("combobox", { name: "Area", exact: true }), "Belum dipasangkan");
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
