import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";
import { buatInspeksiAntre } from "./data";

/**
 * ADR K-12: perubahan oleh pengguna A tampil di layar pengguna B dalam beberapa detik tanpa
 * B memuat ulang. Di CI peristiwa lewat peladen tiruan Ably (e2e/realtime-tiruan.mjs).
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

const klaim = (jwt: string) => JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString("utf8"));

test("token langganan: hanya saluran peran/unit sendiri, hanya subscribe", async ({ page, browser }) => {
    const anon = await browser.newContext();
    expect((await anon.request.get("/api/realtime/token")).status()).toBe(401);
    await anon.close();

    await masuk(page, "inspektur");
    const res = await page.request.get("/api/realtime/token");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/jwt");
    const kap = JSON.parse(klaim(await res.text())["x-ably-capability"]) as Record<string, string[]>;
    expect(Object.keys(kap)).toContain("palk3:inspektur");
    expect(Object.keys(kap)).not.toContain("palk3:staf");
    expect(Object.keys(kap).filter((c) => c.startsWith("palk3:unit:"))).toHaveLength(
        Object.keys(kap).some((c) => c.startsWith("palk3:unit:")) ? 1 : 0,
    );
    expect(Object.values(kap).flat()).toEqual(Object.values(kap).map(() => "subscribe"));
});
