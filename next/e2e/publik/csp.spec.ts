import { expect, test } from "@playwright/test";

/** Audit 19 Nov 2026 (S1): CSP Report-Only terpasang dan penerima laporannya menjawab 204. */
test("CSP Report-Only terpasang; laporan diterima tanpa sesi", async ({ request }) => {
    const r = await request.get("/masuk");
    const csp = r.headers()["content-security-policy-report-only"];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("report-uri /api/csp");
    expect(r.headers()["reporting-endpoints"]).toContain("/api/csp");
    const lapor = await request.post("/api/csp", {
        headers: { "Content-Type": "application/csp-report" },
        data: JSON.stringify({
            "csp-report": { "violated-directive": "img-src", "blocked-uri": "https://contoh.test/a.png" },
        }),
    });
    expect(lapor.status()).toBe(204);
});
