import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
    after: () => {
        throw new Error("di luar permintaan");
    },
}));

const { buatJwt, konfigurasiKlien, terbitkan, tokenLangganan, UMUR_TOKEN_S } = await import("../server");

const dekode = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

describe("realtime Ably", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it("JWT: HS256 dengan rahasia kunci, kid = nama kunci, kapabilitas hanya subscribe saluran sendiri", () => {
        const jwt = buatJwt("app.kunci", "rahasia", "pengguna-9", ["palk3:inspektur", "palk3:unit:2"], 1000);
        const [h, p, t] = jwt.split(".");
        expect(dekode(h!)).toEqual({ typ: "JWT", alg: "HS256", kid: "app.kunci" });
        const isi = dekode(p!);
        expect(isi.iat).toBe(1000);
        expect(isi.exp).toBe(1000 + UMUR_TOKEN_S);
        expect(isi["x-ably-clientId"]).toBe("pengguna-9");
        expect(JSON.parse(isi["x-ably-capability"])).toEqual({
            "palk3:inspektur": ["subscribe"],
            "palk3:unit:2": ["subscribe"],
        });
        expect(t).toBe(createHmac("sha256", "rahasia").update(`${h}.${p}`).digest("base64url"));
    });

    it("bendera fitur: tanpa ABLY_API_KEY atau REALTIME=mati semuanya mati", () => {
        vi.stubEnv("ABLY_API_KEY", "");
        expect(konfigurasiKlien()).toBeNull();
        expect(tokenLangganan(1, ["palk3:staf"])).toBeNull();
        vi.stubEnv("ABLY_API_KEY", "app.kunci:rahasia");
        expect(konfigurasiKlien()).toEqual({});
        vi.stubEnv("REALTIME", "mati");
        expect(konfigurasiKlien()).toBeNull();
    });

    it("terbit: batch publish REST dengan Basic auth; id hanya ke saluran staf", async () => {
        vi.stubEnv("ABLY_API_KEY", "app.kunci:rahasia");
        const panggil: [string, RequestInit][] = [];
        vi.stubGlobal("fetch", async (u: string, i: RequestInit) => (panggil.push([u, i]), new Response("{}")));
        terbitkan({ t: "inspeksi", id: "abc" }, { staf: true, unit: 4 });
        await vi.waitFor(() => expect(panggil).toHaveLength(1));
        const [u, i] = panggil[0]!;
        expect(u).toBe("https://rest.ably.io/messages");
        expect((i.headers as Record<string, string>).authorization).toBe(
            `Basic ${Buffer.from("app.kunci:rahasia").toString("base64")}`,
        );
        expect(JSON.parse(String(i.body))).toEqual([
            { channels: ["palk3:staf"], messages: { name: "berubah", data: '{"t":"inspeksi","id":"abc"}' } },
            { channels: ["palk3:unit:4"], messages: { name: "berubah", data: '{"t":"inspeksi"}' } },
        ]);
    });
});
