import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";
import { baris, buatInspeksiAntre, idPengguna } from "../admin/data";

/** PRD F13: Pemantau ikut meninjau; inspeksi yang sudah ditinjau keluar dari antrean keduanya. */
test("pemantau menolak inspeksi area terbatas dengan catatan; keluar dari antrean admin", async ({ page, browser }) => {
    const insp = await buatInspeksiAntre("sesuai", { terbatas: true });
    await masuk(page, "pemantau");

    await page.goto("/pemantau");
    await expect(page.getByTestId("jumlah-tinjauan")).not.toHaveText("0");
    await page.goto("/pemantau/tinjauan");
    const baris1 = page
        .getByRole("table", { name: "Antrean tinjauan" })
        .getByRole("row")
        .filter({ hasText: insp.kode });
    await expect(baris1.first()).toContainText("Area terbatas (tanpa foto)");

    await page.goto(`/pemantau/tinjauan/${insp.id}`);
    await page.getByText("Ditolak", { exact: true }).click();
    await page.getByLabel("Catatan tinjauan").fill("Petugas tidak berada di area terbatas pada jam itu.");
    await page.getByRole("button", { name: "Simpan tinjauan" }).click();
    await expect(page.getByText("Inspeksi ditolak.")).toBeVisible();
    await expect(page.getByText("Pemantau Demo")).toBeVisible();

    const [r] = await baris<{ hasil_tinjauan: string; ditinjau_oleh: number }>(
        "select hasil_tinjauan, ditinjau_oleh from inspections where id = $1",
        [insp.id],
    );
    expect(r).toEqual({ hasil_tinjauan: "ditolak", ditinjau_oleh: await idPengguna("pemantau") });

    // Admin tidak lagi melihatnya di antrean, dan tidak bisa meninjau ulang.
    const ctx = await browser.newContext();
    const admin = await ctx.newPage();
    await masuk(admin, "admin");
    await admin.goto(`/admin/tinjauan/${insp.id}`);
    await expect(admin.getByRole("heading", { name: "Hasil tinjauan" })).toBeVisible();
    await expect(admin.getByRole("button", { name: "Simpan tinjauan" })).toHaveCount(0);
    await ctx.close();
});

test("inspektur tidak bisa membuka antrean tinjauan", async ({ page }) => {
    await masuk(page, "inspektur");
    await page.goto("/pemantau/tinjauan");
    await expect(page).toHaveURL(/\/petugas/);
});
