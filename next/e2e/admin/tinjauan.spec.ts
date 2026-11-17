import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";
import { baris, buatInspeksiAntre } from "./data";

/** PRD F13 dan ADR-9: antrean bersama Administrator K3 dan Pemantau, satu tinjauan per inspeksi. */
test.describe("tinjauan inspeksi oleh Administrator K3", () => {
    test("bukti, foto per butir, alasan; Diterima dengan catatan; peninjau dan waktu tercatat", async ({
        page,
        playwright,
        baseURL,
    }) => {
        const insp = await buatInspeksiAntre("perlu_tinjauan", { alasan: "gps_lemah" });
        await masuk(page, "admin");

        await page.goto("/admin/tinjauan");
        await expect(page.getByRole("link", { name: /Perlu tinjauan/ })).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("link", { name: /^Tinjauan \(\d+\)$/ })).toBeVisible();

        // Angka antrean di dasbor = lencana tab.
        const lencanaTab = Number(
            await page
                .getByRole("link", { name: /Perlu tinjauan/ })
                .locator("span")
                .textContent(),
        );
        await page.goto("/admin?tab=tinjauan");
        await expect(
            page.getByRole("navigation", { name: "Antrean keputusan" }).getByRole("link", { name: /Perlu tinjauan/ }),
        ).toContainText(String(lencanaTab));

        await page.goto(`/admin/tinjauan/${insp.id}`);
        await expect(page.getByRole("heading", { name: `Inspeksi ${insp.kode}` })).toBeVisible();
        await expect(page.getByText("GPS lemah").first()).toBeVisible();
        await expect(page.getByText("±15 m").first()).toBeVisible();
        await expect(page.locator(".leaflet-container")).toBeVisible();

        // Foto ditautkan ke butirnya dan disajikan lewat rute bersesi.
        const butir = page.getByRole("listitem").filter({ hasText: insp.butir });
        await expect(butir.getByRole("img").first()).toHaveAttribute("src", `/api/foto/${insp.fotoId}`);
        const tamu = await playwright.request.newContext({ baseURL });
        expect((await tamu.get(`/api/foto/${insp.fotoId}`, { maxRedirects: 0 })).status()).not.toBe(200);
        await tamu.dispose();
        expect(await page.content()).not.toMatch(/blob\.vercel-storage\.com|PAL-K3-[0-9a-f]{32}/i);

        // Catatan pendek ditolak peladen; isian dipertahankan.
        await page.getByText("Diterima", { exact: true }).click();
        const catatan = page.getByLabel("Catatan tinjauan");
        await catatan.fill("pendek");
        await catatan.evaluate((el) => el.removeAttribute("minlength"));
        await page.getByRole("button", { name: "Simpan tinjauan" }).click();
        await expect(page.getByRole("alert")).toContainText("minimal 10 karakter");
        await expect(catatan).toHaveValue("pendek");
        await catatan.fill("Petugas di pintu bengkel, sinyal terhalang atap baja.");
        await page.getByRole("button", { name: "Simpan tinjauan" }).click();
        await expect(page.getByText("Inspeksi diterima.")).toBeVisible();
        await expect(page.getByRole("heading", { name: "Hasil tinjauan" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Simpan tinjauan" })).toHaveCount(0);

        const [r] = await baris<{
            hasil_tinjauan: string;
            ditinjau_oleh: number | null;
            ditinjau_pada: Date | null;
            jarak_m: number;
        }>("select hasil_tinjauan, ditinjau_oleh, ditinjau_pada, jarak_m from inspections where id = $1", [insp.id]);
        expect(r).toMatchObject({ hasil_tinjauan: "diterima", jarak_m: 140 });
        expect(r!.ditinjau_oleh).not.toBeNull();
        expect(r!.ditinjau_pada).not.toBeNull();
    });

    test("tab lain dan filter durasi tak wajar merender", async ({ page }) => {
        await masuk(page, "admin");
        for (const tab of ["menyimpang", "tidak_layak", "semua"]) {
            await page.goto(`/admin/tinjauan?tab=${tab}&durasi=1`);
            await expect(page.getByRole("heading", { name: "Tinjauan inspeksi" })).toBeVisible();
        }
    });
});
