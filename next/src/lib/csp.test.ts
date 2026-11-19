import { describe, expect, it } from "vitest";
import { kebijakanCsp } from "./csp";

describe("kebijakanCsp", () => {
    it("produksi: tanpa unsafe-eval, ubin OSM dan Ably diizinkan, framing dilarang, laporan ke /api/csp", () => {
        const k = kebijakanCsp(false);
        expect(k).not.toContain("unsafe-eval");
        expect(k).toContain("img-src 'self' data: blob: https://tile.openstreetmap.org");
        expect(k).toMatch(/connect-src [^;]*wss:\/\/\*\.ably\.net/);
        expect(k).toContain("frame-ancestors 'none'");
        expect(k).toContain("object-src 'none'");
        expect(k).toContain("report-uri /api/csp");
    });
    it("pengembangan: unsafe-eval untuk React dev", () => {
        expect(kebijakanCsp(true)).toContain("'unsafe-eval'");
    });
});
