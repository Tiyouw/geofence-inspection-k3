import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

test.describe("dasbor admin", () => {
    test.beforeEach(async ({ page }) => {
        await masuk(page, "admin");
    });

    test("menampilkan kepatuhan, empat antrean, dan peta tanpa token", async ({ page }) => {
        await expect(page.getByRole("heading", { name: /^Halo, / })).toBeVisible();
        await expect(page.getByRole("heading", { name: /Ringkasan kepatuhan/ })).toBeVisible();
        const antrean = page.getByRole("navigation", { name: "Antrean keputusan" });
        for (const t of ["Temuan berat", "Lewat tenggat", "Tinjauan posisi", "Belum diperiksa"]) {
            await expect(antrean.getByRole("link", { name: new RegExp(t) })).toBeVisible();
        }
        await expect(page.locator(".leaflet-container")).toBeVisible();
        // C3: token tidak pernah ada di HTML dasbor.
        expect(await page.content()).not.toMatch(/PAL-K3-[0-9a-f]{32}/i);
    });

    test("nilai tab di luar daftar ditolak (I3)", async ({ page }) => {
        const res = await page.goto("/admin?tab=hapus");
        expect(res?.status()).toBe(404);
    });

    test("halaman antrean di luar rentang dikoreksi (I4)", async ({ page }) => {
        await page.goto("/admin?tab=belum&hal=999");
        await expect(page).toHaveURL(/\/admin\?tab=belum(&hal=\d+)?$/);
        await expect(page.getByRole("heading", { name: "Belum diperiksa" })).toBeVisible();
    });
});
