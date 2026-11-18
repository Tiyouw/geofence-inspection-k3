import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

test.describe("dasbor admin", () => {
    test.beforeEach(async ({ page }) => {
        await masuk(page, "admin");
    });

    test("menampilkan kepatuhan, progres empat modul, tiga antrean, dan peta tanpa token", async ({ page }) => {
        await expect(page.getByRole("heading", { level: 1, name: /^Ringkasan / })).toBeVisible();
        await expect(page.getByRole("heading", { name: /Ringkasan kepatuhan/ })).toBeVisible();
        const antrean = page.getByRole("navigation", { name: "Antrean keputusan" });
        for (const t of ["Temuan berat", "Perlu tinjauan", "Belum diperiksa"]) {
            await expect(antrean.getByRole("link", { name: new RegExp(t) })).toBeVisible();
        }
        await expect(antrean.getByRole("link", { name: /Lewat tenggat/ })).toHaveCount(0);
        const modul = page.getByTestId("progres-modul");
        for (const m of ["APAR", "Mobil Pemadam"]) await expect(modul).toContainText(m);
        await expect(modul).toContainText("Minggu ini");
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
