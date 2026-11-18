import { expect, test, type Page } from "@playwright/test";
import { masuk, pilih } from "../helpers";

const MM = 96 / 25.4;

/** Jumlah stiker di ringkasan ("12 stiker · 2 lembar A4"). */
async function jumlahRingkasan(page: Page): Promise<number> {
    const teks = (await page.getByTestId("ringkasan-stiker").textContent()) ?? "";
    return Number(teks.match(/(\d+)\s*stiker/)?.[1] ?? NaN);
}

test.describe("lembar stiker QR (L7, C3, B10)", () => {
    test("tiga tata letak dengan ukuran mm tepat, filter kode, token tercetak", async ({ page }) => {
        await masuk(page, "admin");
        for (const [tata, lebar, tinggi, per] of [
            ["3x8", 63.5, 33.9, 24],
            ["2x5", 99.1, 57, 10],
            ["2x4", 99.1, 67.7, 8],
        ] as const) {
            await page.goto(`/stiker?tata=${tata}`);
            const label = page.locator(".stiker-label").first();
            const box = (await label.boundingBox())!;
            expect(Math.abs(box.width - lebar * MM)).toBeLessThan(1);
            expect(Math.abs(box.height - tinggi * MM)).toBeLessThan(1);
            const isiLembar = await page.locator(".stiker-lembar").first().locator(".stiker-label").count();
            expect(isiLembar).toBeLessThanOrEqual(per);
        }

        await page.goto("/stiker?kode=01D,%2002D");
        await expect(page.locator(".stiker-label")).toHaveCount(2);
        const token = (await page.locator(".stiker-token").first().textContent())!.trim();
        // Dicetak per 4 karakter supaya mudah diketik ulang sebagai kode cadangan.
        expect(token).toMatch(/^PAL-K3-[0-9a-f]{4}( [0-9a-f]{4}){7}$/);
        await expect(page.locator(".stiker-qr svg").first()).toBeVisible();
        // Label: ikon modul (SVG, bukan emoji), nama area, perintah pindai.
        const pertama = page.locator(".stiker-label").first();
        await expect(pertama.locator(".stiker-jenis svg")).toHaveCount(1);
        await expect(pertama.locator(".stiker-area")).not.toBeEmpty();
        await expect(pertama.locator(".stiker-perintah")).toHaveText("Pindai sebelum memeriksa");
    });

    test("halaman di dalam kerangka admin; saringan berlaku seketika tanpa tombol Terapkan", async ({ page }) => {
        await masuk(page, "admin");
        await page.goto("/stiker");
        await expect(page.getByRole("navigation", { name: "Menu utama" })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Menu utama" }).getByRole("link", { name: "Stiker QR" })).toHaveAttribute("aria-current", "page");
        await expect(page.getByRole("button", { name: "Terapkan" })).toHaveCount(0);
        const semua = await jumlahRingkasan(page);
        expect(semua).toBeGreaterThan(0);
        const saring = page.getByRole("region", { name: "Saring stiker" });

        // Area: poligon disetujui; semua label menyebut area itu.
        await pilih(saring.getByRole("combobox", { name: "Area" }), "Gedung PIP");
        await expect(page).toHaveURL(/area=\d+/);
        const diArea = await jumlahRingkasan(page);
        expect(diArea).toBeGreaterThan(0);
        expect(diArea).toBeLessThan(semua);
        await expect(page.locator(".stiker-label")).toHaveCount(diArea);
        for (const t of await page.locator(".stiker-area").allTextContents()) expect(t).toBe("Gedung PIP");

        // Lantai mempersempit di dalam area.
        await pilih(saring.getByRole("combobox", { name: "Lantai" }), "Lt. 2");
        await expect(page).toHaveURL(/lantai=Lt\.\+2|lantai=Lt\.%202/);
        await expect(page).toHaveURL(/area=\d+/);
        const diLantai = await jumlahRingkasan(page);
        expect(diLantai).toBeLessThan(diArea);
        for (const t of await page.locator(".stiker-lokasi").allTextContents()) expect(t).toContain("Lt. 2");

        // Jenis objek: kotak centang, boleh lebih dari satu.
        await saring.getByRole("checkbox").first().waitFor();
        await saring.locator("label", { hasText: "Kotak P3K" }).click();
        await expect(page).toHaveURL(/tipe=p3k/);
        for (const t of await page.locator(".stiker-jenis").allTextContents()) expect(t).toBe("Kotak P3K");
        await saring.locator("label", { hasText: "Hydrant Box" }).click();
        await expect(page).toHaveURL(/tipe=hydrant_box%2Cp3k|tipe=hydrant_box,p3k/);
        for (const t of await page.locator(".stiker-jenis").allTextContents())
            expect(["Kotak P3K", "Hydrant Box"]).toContain(t);

        // Hapus saringan mengembalikan semua.
        await saring.getByRole("button", { name: "Hapus saringan" }).click();
        await expect(page).toHaveURL(/\/stiker$/);
        await expect.poll(() => jumlahRingkasan(page)).toBe(semua);

        // Belum berarea: hanya aset tanpa area (mis. mobil pemadam); jumlahnya sama dengan di pilihan.
        await pilih(saring.getByRole("combobox", { name: "Area" }), /^Belum berarea \(\d+\)$/);
        await expect(page).toHaveURL(/area=belum/);
        const n = Number((await saring.getByRole("combobox", { name: "Area" }).textContent())!.match(/\((\d+)\)/)![1]);
        expect(n).toBeGreaterThan(0);
        await expect.poll(() => jumlahRingkasan(page)).toBe(n);
        await expect(page.locator(".stiker-label")).toHaveCount(n);
    });

    test("kode aset sebagai keping: Enter, koma, dan hapus", async ({ page }) => {
        await masuk(page, "admin");
        await page.goto("/stiker");
        const kotak = page.getByLabel(/Kode aset tertentu/);
        await kotak.fill("01D");
        await kotak.press("Enter");
        await expect(page).toHaveURL(/kode=01D$/);
        await kotak.pressSequentially("02D,");
        await expect(page).toHaveURL(/kode=01D%2C02D|kode=01D,02D/);
        await expect(page.getByTestId("keping-kode")).toHaveText(["01D", "02D"]);
        await expect(page.locator(".stiker-label")).toHaveCount(2);
        await page.getByRole("button", { name: "Hapus kode 01D" }).click();
        await expect(page).toHaveURL(/kode=02D$/);
        await expect(page.locator(".stiker-label")).toHaveCount(1);
        await expect(page.locator(".stiker-label").first()).toHaveAttribute("data-kode", "02D");
    });

    test("cetak: tanpa kerangka aplikasi, lembar di tepi kertas, ukuran label tetap", async ({ page }) => {
        await masuk(page, "admin");
        await page.goto("/stiker?tata=3x8&kode=01D,02D");
        await page.emulateMedia({ media: "print" });
        await expect(page.getByRole("navigation", { name: "Menu utama" })).toBeHidden();
        await expect(page.getByRole("region", { name: "Saring stiker" })).toBeHidden();
        await expect(page.getByRole("button", { name: "Cetak" })).toBeHidden();
        await expect(page.getByTestId("ringkasan-stiker")).toBeHidden();
        const lembar = (await page.locator(".stiker-lembar").first().boundingBox())!;
        expect(Math.abs(lembar.x)).toBeLessThan(1);
        expect(Math.abs(lembar.width - 210 * MM)).toBeLessThan(1);
        const label = (await page.locator(".stiker-label").first().boundingBox())!;
        expect(Math.abs(label.width - 63.5 * MM)).toBeLessThan(1);
        expect(Math.abs(label.height - 33.9 * MM)).toBeLessThan(1);
        const gaya = await page.locator(".stiker-label").first().evaluate((el) => {
            const s = getComputedStyle(el);
            const lembarEl = el.closest(".stiker-lembar")!;
            return {
                outline: s.outlineStyle,
                bayangan: getComputedStyle(lembarEl).boxShadow,
                qr: (el.querySelector(".stiker-qr svg") as SVGElement).getBoundingClientRect().width,
            };
        });
        expect(gaya.outline).toBe("none");
        expect(gaya.bayangan).toBe("none");
        // QR 24 mm termasuk quiet zone (tata 3x8).
        expect(Math.abs(gaya.qr - 24 * MM)).toBeLessThan(1);
    });

    test("ponsel: kontrol tidak meluap dan pratinjau dikecilkan", async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await masuk(page, "admin");
        await page.goto("/stiker");
        const lebarDok = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(lebarDok).toBeLessThanOrEqual(390);
        const area = (await page.getByRole("combobox", { name: "Area" }).boundingBox())!;
        expect(area.height).toBeGreaterThanOrEqual(40);
    });

    for (const akun of ["pemantau", "inspektur"] as const) {
        test(`${akun} tidak bisa membuka lembar stiker`, async ({ page }) => {
            await masuk(page, akun);
            await page.goto("/stiker");
            await expect(page).not.toHaveURL(/\/stiker/);
            expect(await page.content()).not.toMatch(/PAL-K3-[0-9a-f]{32}/i);
        });
    }
});
