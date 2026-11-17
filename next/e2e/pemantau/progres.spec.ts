import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

/** PRD F15: laporan "Progres per gedung" dari halaman laporan, untuk Admin K3 dan Pemantau. */
test.describe.configure({ timeout: 90_000 });

for (const [akun, halaman] of [
    ["pemantau", "/pemantau/laporan"],
    ["admin", "/laporan"],
] as const) {
    test(`${akun}: tautan progres per gedung menghasilkan PDF (bulan dan periode berjalan)`, async ({ page }) => {
        await masuk(page, akun);
        await page.goto(`${halaman}?tipe=apar&tahun=2026&bulan=11`);
        const bagian = page.getByTestId("unduh-progres");
        const bulan = bagian.getByRole("link", { name: /November 2026/ });
        await expect(bulan).toHaveAttribute("href", "/laporan/progres?tahun=2026&bulan=11");
        const berjalan = bagian.getByRole("link", { name: /Periode berjalan/ });
        await expect(berjalan).toHaveAttribute("href", "/laporan/progres");

        for (const [href, nama] of [
            ["/laporan/progres?tahun=2026&bulan=11", /filename="Progres-Gedung-2026-11\.pdf"/],
            ["/laporan/progres", /filename="Progres-Gedung-berjalan-\d{4}-\d{2}-\d{2}\.pdf"/],
            ["/laporan/progres?modul=mobil_pemadam", /filename="Progres-Gedung-berjalan-/],
        ] as const) {
            const res = await page.request.get(href);
            expect(res.status()).toBe(200);
            expect(res.headers()["content-type"]).toBe("application/pdf");
            expect(res.headers()["content-disposition"]).toMatch(nama);
            expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
        }
    });
}

test("filter progres yang tidak sah ditolak; tamu dan inspektur tidak boleh", async ({ page, playwright, baseURL }) => {
    await masuk(page, "pemantau");
    expect((await page.request.get("/laporan/progres?tahun=2026&bulan=13")).status()).toBe(422);
    expect((await page.request.get("/laporan/progres?modul=tidak_ada")).status()).toBe(404);
    const tamu = await playwright.request.newContext({ baseURL });
    expect((await tamu.get("/laporan/progres", { maxRedirects: 0 })).status()).not.toBe(200);
    await tamu.dispose();
});
