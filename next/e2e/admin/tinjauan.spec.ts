import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";
import { baris, buatInspeksiAntre } from "./data";

test.describe("tinjauan inspeksi (E7, H5-H7, F5)", () => {
    test("antrean, foto bersesi, tandai ditinjau dengan alasan, GPS tetap", async ({ page, playwright, baseURL }) => {
        const insp = await buatInspeksiAntre("perlu_review");
        await masuk(page, "admin");

        // Tab bawaan = Antre ditinjau bila ada antrean; lencana menu menunjukkan jumlahnya.
        await page.goto("/admin/tinjauan");
        await expect(page.getByRole("link", { name: /Antre ditinjau/ })).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("link", { name: /^Tinjauan \(\d+\)$/ })).toBeVisible();

        // E7: jumlah antrean dasbor (APAR) sama dengan lencana tab.
        const lencanaTab = Number(
            await page
                .getByRole("link", { name: /Antre ditinjau/ })
                .locator("span")
                .textContent(),
        );
        await page.goto("/admin?tab=posisi");
        const kartuPosisi = page
            .getByRole("navigation", { name: "Antrean keputusan" })
            .getByRole("link", { name: /Tinjauan posisi/ });
        await expect(kartuPosisi).toContainText(String(lencanaTab));

        await page.goto(`/admin/tinjauan/${insp.id}`);
        await expect(page.getByRole("heading", { name: `Inspeksi ${insp.kode}` })).toBeVisible();
        await expect(page.getByText("Bukti lapangan (tidak dapat diubah)")).toBeVisible();

        // F5: foto tampil lewat /api/foto dan tidak bisa dibuka tanpa sesi.
        const img = page.getByRole("img", { name: /Foto bukti 1/ });
        await expect(img).toHaveAttribute("src", `/api/foto/${insp.fotoId}`);
        const res = await page.request.get(`/api/foto/${insp.fotoId}`);
        expect(res.status()).toBe(200);
        expect(res.headers()["content-type"]).toBe("image/jpeg");
        const tamu = await playwright.request.newContext({ baseURL });
        expect((await tamu.get(`/api/foto/${insp.fotoId}`, { maxRedirects: 0 })).status()).not.toBe(200);
        await tamu.dispose();
        expect(await page.content()).not.toMatch(/blob\.vercel-storage\.com|PAL-K3-[0-9a-f]{32}/i);

        // H6: alasan < 10 karakter ditolak; input dipertahankan.
        await page.getByRole("button", { name: "Tinjau posisi" }).click();
        const alasan = page.getByLabel("Alasan atau hasil verifikasi");
        await alasan.fill("pendek");
        await alasan.evaluate((el) => el.removeAttribute("minlength"));
        await page.getByRole("button", { name: "Tandai ditinjau" }).click();
        await expect(page.getByRole("alert")).toContainText("minimal 10 karakter");
        await expect(alasan).toHaveValue("pendek");
        await alasan.fill("Dicek lewat CCTV, petugas hadir di lokasi.");
        await page.getByRole("button", { name: "Tandai ditinjau" }).click();
        await expect(page.getByText("Tinjauan posisi tersimpan.")).toBeVisible();
        await expect(page.getByText(/oleh Administrator/)).toBeVisible();
        await expect(page.getByRole("button", { name: "Tinjau posisi" })).toHaveCount(0);

        const [r] = await baris<{
            jarak_m: number;
            gps_lat: string;
            gate_status: string;
            ditinjau_oleh: number | null;
        }>("select jarak_m, gps_lat, gate_status, ditinjau_oleh from inspections where id = $1", [insp.id]);
        expect(r).toMatchObject({ jarak_m: 140, gps_lat: "-7.2000000", gate_status: "perlu_review" });
        expect(r!.ditinjau_oleh).not.toBeNull();

        // H5: catatan tinjauan tetap bisa diperbarui; bukti tidak punya kolom isian.
        await page.getByLabel("Catatan tinjauan").fill("Catatan tambahan admin.");
        await page.getByRole("button", { name: "Simpan catatan" }).click();
        await expect(page.getByText("Catatan tinjauan tersimpan.")).toBeVisible();
    });

    test("tab lain dan filter durasi tak wajar merender", async ({ page }) => {
        await masuk(page, "admin");
        for (const tab of ["menyimpang", "tidak_layak", "semua"]) {
            await page.goto(`/admin/tinjauan?tab=${tab}&durasi=1`);
            await expect(page.getByRole("heading", { name: "Tinjauan inspeksi" })).toBeVisible();
        }
    });
});
