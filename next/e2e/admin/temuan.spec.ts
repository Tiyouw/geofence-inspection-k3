import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";
import { baris, buatTemuan } from "./data";

test.describe("temuan dan tindak lanjut (H9, I2, I5)", () => {
    test.beforeEach(async ({ page }) => {
        await masuk(page, "admin");
    });

    test("siklus terbuka → proses → selesai → dibuka kembali, dengan tenggat dan jejak", async ({ page }) => {
        const t = await buatTemuan("sedang");
        await page.goto(`/admin/temuan/${t.id}`);
        await expect(page.getByRole("heading", { name: new RegExp(t.item) })).toBeVisible();

        // Tenggat sebelum hari ini ditolak peladen (min di klien dilepas untuk menguji peladen).
        await page.getByRole("button", { name: "Tetapkan tenggat" }).click();
        const tgl = page.getByLabel("Target penyelesaian");
        await tgl.evaluate((el) => el.removeAttribute("min"));
        await tgl.fill("2020-01-01");
        await page.getByRole("button", { name: "Simpan" }).click();
        await expect(page.getByRole("alert")).toContainText("Tenggat tidak boleh sebelum hari ini.");
        await tgl.fill("2099-12-31");
        await page.getByRole("button", { name: "Simpan" }).click();
        await expect(page.getByText("Tenggat tersimpan.")).toBeVisible();

        await page.getByRole("button", { name: "Mulai proses" }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Mulai proses" }).click();
        await expect(page.getByText("Status temuan: Dalam proses.")).toBeVisible();

        await page.getByRole("button", { name: "Tandai selesai" }).click();
        const uraian = page.getByLabel("Tindakan yang sudah dilakukan");
        await uraian.fill("kurang");
        await uraian.evaluate((el) => el.removeAttribute("minlength"));
        await page.getByRole("dialog").getByRole("button", { name: "Tandai selesai" }).click();
        await expect(page.getByRole("alert")).toContainText("minimal 10 karakter");
        await uraian.fill("Tabung diganti unit cadangan dari gudang.");
        await page.getByRole("dialog").getByRole("button", { name: "Tandai selesai" }).click();
        await expect(page.getByText("Status temuan: Selesai.")).toBeVisible();
        await expect(page.getByText("Tabung diganti unit cadangan dari gudang.").first()).toBeVisible();

        await page.getByRole("button", { name: "Buka kembali" }).click();
        await page.getByLabel("Uraian").fill("Ditemukan bocor lagi saat inspeksi ulang.");
        await page.getByRole("dialog").getByRole("button", { name: "Buka kembali" }).click();
        await expect(page.getByText("Status temuan: Terbuka.")).toBeVisible();

        const jejak = await baris<{ aksi: string }>("select aksi from issue_events where issue_id = $1 order by id", [
            t.id,
        ]);
        expect(jejak.map((j) => j.aksi)).toEqual(["tenggat", "status", "status", "status"]);
    });

    test("dasbor: temuan berat selesai keluar dari antrean (I2)", async ({ page }) => {
        const t = await buatTemuan("berat");
        // Temuan terlama tampil dulu; cari halaman yang memuat temuan ini.
        let ketemu = false;
        for (let hal = 1; hal <= 20 && !ketemu; hal++) {
            await page.goto(`/admin?hal=${hal}`);
            // Isi dasbor menyusul di balik kerangka muat.
            await expect(page.getByRole("heading", { name: /Perlu keputusan Anda/ })).toBeVisible();
            ketemu = (await page.getByRole("link", { name: new RegExp(t.item) }).count()) > 0;
            if (!ketemu && !(await page.getByRole("link", { name: "Berikutnya" }).count())) break;
        }
        expect(ketemu).toBe(true);
        const item = page.getByRole("listitem").filter({ hasText: t.item });
        await item.getByRole("button", { name: "Tandai selesai" }).click();
        await page.getByLabel("Tindakan yang sudah dilakukan").fill("Diganti dengan unit cadangan.");
        await page.getByRole("dialog").getByRole("button", { name: "Tandai selesai" }).click();
        await expect(page.getByText("Status temuan: Selesai.")).toBeVisible();
        await expect(page.getByRole("link", { name: new RegExp(t.item) })).toHaveCount(0);
    });

    test("temuan manual memakai pilihan terkontrol", async ({ page }) => {
        const item = `Manual ${Date.now().toString(36)}`;
        await page.goto("/admin/temuan/baru");
        await page.getByRole("button", { name: "Simpan temuan" }).click();
        await expect(page.getByText("Aset wajib dipilih.")).toBeVisible();
        await page.getByLabel("Aset").selectOption({ index: 1 });
        await page.getByLabel("Uraian temuan").fill(item);
        await page.getByLabel("Tingkat").selectOption("ringan");
        await page.getByRole("button", { name: "Simpan temuan" }).click();
        await expect(page).toHaveURL(/\/admin\/temuan\/\d+$/);
        await expect(page.getByText("Dibenahi pada kunjungan berikutnya (baku)")).toBeVisible();
        const [a] = await baris<{ aksi: string }>(
            "select aksi from audit_logs where aksi = 'temuan.buat' order by id desc limit 1",
        );
        expect(a?.aksi).toBe("temuan.buat");
    });
});
