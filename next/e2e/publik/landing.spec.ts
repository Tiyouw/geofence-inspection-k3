import { expect, test } from "@playwright/test";

test.describe("halaman depan (M1)", () => {
    test("merender isi, media, dan modul dari data tanpa token/koordinat", async ({ page }) => {
        const gagal: string[] = [];
        page.on("response", (r) => {
            if (r.url().includes("/media/") && r.status() >= 400) gagal.push(`${r.status()} ${r.url()}`);
        });
        await page.goto("/");
        await expect(page).toHaveTitle("Geofencing — Sistem Inspeksi K3 — PT PAL Indonesia");
        await expect(
            page.getByRole("heading", { level: 1, name: "Inspeksi APAR yang terbukti dilakukan di tempatnya." }),
        ).toBeVisible();
        await expect(page.locator("video[data-video-latar]")).toHaveAttribute("poster", "/media/pal/hero-poster.webp");
        for (const id of ["pengaman", "cara-kerja", "peran", "dasar-hukum", "modul", "tentang"]) {
            await expect(page.locator(`#${id}`)).toBeAttached();
        }
        // Kartu modul dari asset_types: APAR sudah beroperasi.
        const apar = page.locator("#modul li").filter({ hasText: "APAR" });
        await expect(apar).toContainText("Sudah beroperasi");
        await expect(apar).toContainText("Periode Bulanan");

        // Foto termuat (gulir supaya lazy-load berjalan).
        await page.locator("#tentang").scrollIntoViewIfNeeded();
        const foto = page.locator("#pengaman img").first();
        await foto.scrollIntoViewIfNeeded();
        await expect.poll(() => foto.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
        const video = await page.request.get("/media/pal/hero-lebar.mp4", { headers: { Range: "bytes=0-99" } });
        expect([200, 206]).toContain(video.status());
        expect(gagal).toEqual([]);

        const html = await page.content();
        expect(html).not.toMatch(/PAL-K3-[0-9a-f]{32}/i);
        expect(html).not.toMatch(/-7\.\d{4,}/);

        // Tombol Masuk menuju satu pintu masuk.
        await page.getByRole("link", { name: "Masuk", exact: true }).click();
        await expect(page).toHaveURL(/\/masuk$/);
    });

    test("gerak dikurangi: isi langsung tampil dan video tidak dimuat", async ({ browser }) => {
        const ctx = await browser.newContext({ reducedMotion: "reduce" });
        const page = await ctx.newPage();
        await page.goto("/", { waitUntil: "load" });
        await expect(page.locator("#cara-kerja h2")).toHaveCSS("opacity", "1");
        await page.waitForTimeout(500);
        expect(await page.locator("video[data-video-latar]").getAttribute("src")).toBeNull();
        await ctx.close();
    });

    test("menu ponsel membuka dan menutup", async ({ browser }) => {
        const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await ctx.newPage();
        await page.goto("/");
        await page.getByRole("button", { name: "Buka menu" }).click();
        await expect(page.getByRole("navigation", { name: "Menu ponsel" })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("navigation", { name: "Menu ponsel" })).toBeHidden();
        await ctx.close();
    });

    test("/admin/login dialihkan ke /masuk", async ({ page }) => {
        await page.goto("/admin/login");
        await expect(page).toHaveURL(/\/masuk$/);
    });
});
