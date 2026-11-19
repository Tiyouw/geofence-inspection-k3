import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
    after: () => {
        throw new Error("di luar permintaan");
    },
}));

const { permintaanBertanda, tandaTanganSaluran, tandaTanganSah, konfigurasiKlien } = await import("../server");

// Contoh dari dokumentasi Pusher (HTTP API "Generating authentication signatures" dan "Private channels").
const APP = { appId: "3", key: "278d425bdf160c739803", secret: "7ad3773142a6692b25b8" };

describe("tanda tangan Pusher", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("REST: sama dengan contoh dokumentasi", () => {
        const body = '{"name":"foo","channels":["project-3"],"data":"{\\"some\\":\\"data\\"}"}';
        const { jalur, query } = permintaanBertanda(APP, "events", body, 1353088179);
        expect(jalur).toBe("/apps/3/events");
        expect(query).toContain("body_md5=ec365a775a4cd0599faeb73354201b6f");
        expect(query).toContain("auth_signature=da454824c97ba181a32ccc17a72625ba02771f50b50e1e7430e47a1f3f457e6c");
    });

    it("langganan saluran privat: sama dengan contoh dokumentasi dan terikat socket_id", () => {
        vi.stubEnv("PUSHER_APP_ID", APP.appId);
        vi.stubEnv("PUSHER_KEY", APP.key);
        vi.stubEnv("PUSHER_SECRET", APP.secret);
        vi.stubEnv("PUSHER_CLUSTER", "ap1");
        const auth = tandaTanganSaluran("1234.1234", "private-foobar");
        expect(auth).toBe("278d425bdf160c739803:58df8b0c36d6982b82c3ecf6b4662e34fe8c25bba48f5369f135bf843651c3a4");
        expect(tandaTanganSah(APP.secret, APP.key, "1234.1234", "private-foobar", auth!)).toBe(true);
        expect(tandaTanganSah(APP.secret, APP.key, "1234.1235", "private-foobar", auth!)).toBe(false);
        expect(tandaTanganSaluran("bukan-socket", "private-foobar")).toBeNull();
        expect(konfigurasiKlien()).toEqual({ key: APP.key, ws: "wss://ws-ap1.pusher.com" });
    });

    it("tanpa konfigurasi: mati", () => {
        vi.stubEnv("PUSHER_KEY", "");
        expect(konfigurasiKlien()).toBeNull();
        expect(tandaTanganSaluran("1.1", "private-staf")).toBeNull();
    });
});
