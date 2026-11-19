import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";
import { buatInspeksiAntre } from "./data";

/**
 * ADR K-12: perubahan oleh pengguna A tampil di layar pengguna B dalam beberapa detik tanpa
 * B memuat ulang. Di CI peristiwa lewat peladen tiruan Pusher (e2e/realtime-tiruan.mjs).
 */
test("tinjauan oleh pemantau hilang dari antrean admin yang sedang terbuka dalam beberapa detik", async ({
    page,
    browser,
}) => {
    const insp = await buatInspeksiAntre("sesuai", { terbatas: true });

    // B: admin membuka antrean tinjauan dan tetap di sana.
    await masuk(page, "admin");
    await page.goto("/admin/tinjauan");
    await expect(page.locator("html")).toHaveAttribute("data-realtime", "tersambung", { timeout: 15_000 });
    const barisB = page
        .getByRole("table", { name: "Antrean tinjauan" })
        .getByRole("row")
        .filter({ hasText: insp.kode });
    await expect(barisB.first()).toBeVisible();
    await page.evaluate(() => ((window as unknown as { __tanpaMuatUlang: boolean }).__tanpaMuatUlang = true));

    // A: pemantau di peramban lain memutuskan tinjauan.
    const ctx = await browser.newContext();
    const a = await ctx.newPage();
    await masuk(a, "pemantau");
    await a.goto(`/pemantau/tinjauan/${insp.id}`);
    await a.getByText("Diterima", { exact: true }).click();
    await a.getByLabel("Catatan tinjauan").fill("Diperiksa ulang lewat telepon, petugas memang di lokasi.");
    await a.getByRole("button", { name: "Simpan tinjauan" }).click();
    await expect(a.getByText("Inspeksi diterima.")).toBeVisible();
    const t0 = Date.now();

    await expect(
        page.getByRole("table", { name: "Antrean tinjauan" }).getByRole("row").filter({ hasText: insp.kode }),
    ).toHaveCount(0, {
        timeout: 5_000,
    });
    const jedaMs = Date.now() - t0;
    test.info().annotations.push({ type: "jeda-realtime-ms", description: String(jedaMs) });
    console.log(`[realtime] jeda tinjauan A -> antrean B: ${jedaMs} ms`);
    // Halaman B tidak dimuat ulang penuh: hanya isinya yang disegarkan.
    expect(await page.evaluate(() => (window as unknown as { __tanpaMuatUlang?: boolean }).__tanpaMuatUlang)).toBe(
        true,
    );
    await ctx.close();
});

test("langganan saluran: hanya saluran milik peran/unit sendiri yang ditandatangani", async ({ page, browser }) => {
    const anon = await browser.newContext();
    const r0 = await anon.request.post("/api/realtime/auth", {
        data: { socket_id: "1.1", channel_name: "private-staf" },
    });
    expect(r0.status()).toBe(401);
    await anon.close();

    await masuk(page, "inspektur");
    const staf = await page.request.post("/api/realtime/auth", {
        data: { socket_id: "1.1", channel_name: "private-staf" },
    });
    expect(staf.status()).toBe(403);
    const unitLain = await page.request.post("/api/realtime/auth", {
        data: { socket_id: "1.1", channel_name: "private-unit-999999" },
    });
    expect(unitLain.status()).toBe(403);
    const milik = await page.request.post("/api/realtime/auth", {
        data: { socket_id: "1.1", channel_name: "private-inspektur" },
    });
    expect(milik.status()).toBe(200);
    expect((await milik.json()).auth).toMatch(/^[^:]+:[0-9a-f]{64}$/);
});
