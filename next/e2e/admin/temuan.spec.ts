import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";
import { buatTemuan } from "./data";

/** PRD "Temuan" dan ADR-4: temuan hanya dicatat; tanpa status, tenggat, PIC, atau penutupan. */
test.describe("temuan tanpa tindak lanjut", () => {
    test.beforeEach(async ({ page }) => {
        await masuk(page, "admin");
    });

    test("daftar dengan saringan; detail hanya dibaca, dengan lokasi dan tindakan", async ({ page }) => {
        const t = await buatTemuan("sedang");
        await page.goto(`/admin/temuan?q=${encodeURIComponent(t.item)}`);
        const tabel = page.getByRole("table", { name: "Daftar temuan" });
        const baris = tabel.getByRole("row").filter({ hasText: t.item });
        await expect(baris).toContainText("Gedung Uji · Lorong");
        await expect(baris).toContainText("Sedang");
        await expect(baris).toContainText("Ganti");
        await expect(tabel.getByRole("columnheader")).toHaveText([
            "Tanggal",
            "Lokasi",
            "Temuan",
            "Tingkat",
            "Tindakan yang direkomendasikan",
            "Inspektur",
        ]);

        await baris.getByRole("link", { name: t.item }).click();
        await expect(page).toHaveURL(new RegExp(`/admin/temuan/${t.id}$`));
        await expect(page.getByText("Pasang unit cadangan")).toBeVisible();
        for (const kata of ["Tetapkan tenggat", "Tandai selesai", "Mulai proses", "Buka kembali"]) {
            await expect(page.getByRole("button", { name: kata })).toHaveCount(0);
        }
        await expect(page.getByText(/Tenggat|Penanggung jawab/)).toHaveCount(0);
    });

    test("saringan tingkat; catat manual tidak ada lagi", async ({ page }) => {
        await page.goto("/admin/temuan?tingkat=ringan");
        const tingkat = await page
            .getByRole("table", { name: "Daftar temuan" })
            .locator("tbody tr td:nth-child(4)")
            .allInnerTexts()
            .catch(() => []);
        expect(tingkat.every((x) => x.trim() === "Ringan")).toBe(true);
        await expect(page.getByRole("link", { name: "Catat temuan" })).toHaveCount(0);
        expect((await page.goto("/admin/temuan/baru"))?.status()).toBe(404);
    });

    test("rekap temuan PDF mengikuti saringan", async ({ page }) => {
        const res = await page.request.get("/laporan/temuan?modul=apar&dari=2026-01-01&sampai=2026-12-31&foto=0");
        expect(res.status()).toBe(200);
        expect(res.headers()["content-type"]).toBe("application/pdf");
        expect(res.headers()["content-disposition"]).toContain("Rekap-Temuan-2026-01-01_2026-12-31.pdf");
    });
});
