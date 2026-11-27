import { expect, test } from "@playwright/test";

/** Audit 19 Nov 2026 (R4): belum dipublikasikan, jadi tidak diindeks; tautan lewati ada. */
test("robots.txt menolak semua dan halaman membawa X-Robots-Tag noindex", async ({ request }) => {
    const r = await request.get("/robots.txt", { maxRedirects: 0 });
    expect(r.status()).toBe(200);
    expect(await r.text()).toMatch(/Disallow: \/\s*$/m);
    expect((await request.get("/masuk")).headers()["x-robots-tag"]).toContain("noindex");
});
