/**
 * Kunci masuk luas (audit 19 Nov 2026, S2): per NIP dari banyak IP, dan per IP untuk banyak NIP.
 * Integrasi terhadap Postgres uji; dilewati bila DATABASE_URL tidak ada.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const adaDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!adaDb)("kunci masuk luas (integrasi)", async () => {
    const { db } = await import("@/db");
    const { auditLogs } = await import("@/db/schema");
    const { sql } = await import("drizzle-orm");
    const { sisaKunciLuas, MAX_GAGAL_NIP, MAX_GAGAL_IP } = await import("./kunci");
    const tanda = `uji-kunci-${Date.now()}`;

    afterAll(async () => {
        await db.delete(auditLogs).where(sql`${auditLogs.data}->>'uji' = ${tanda}`);
    });

    const gagal = (nip: string, ip: string, n: number) =>
        db
            .insert(auditLogs)
            .values(Array.from({ length: n }, () => ({ aksi: "masuk.gagal", data: { nip, uji: tanda }, ip })));

    it("satu NIP ditebak dari banyak IP: terkunci setelah batas, NIP lain tidak", async () => {
        const nip = `${tanda}-a`;
        for (let i = 0; i < MAX_GAGAL_NIP - 1; i++) await gagal(nip, `10.9.${i}.1`, 1);
        expect(await sisaKunciLuas(nip, "10.8.0.1")).toBe(0);
        await gagal(nip, "10.9.99.1", 1);
        expect(await sisaKunciLuas(nip, "10.8.0.1")).toBeGreaterThan(60);
        expect(await sisaKunciLuas(`${tanda}-lain`, "10.8.0.1")).toBe(0);
        // Masuk berhasil membersihkan hitungan NIP itu.
        await db.insert(auditLogs).values({ aksi: "masuk", data: { nip, uji: tanda }, ip: "10.8.0.1" });
        expect(await sisaKunciLuas(nip, "10.8.0.1")).toBe(0);
    });

    it("satu IP mencoba banyak NIP: IP terkunci, IP lain tidak", async () => {
        const ip = `10.7.${Date.now() % 250}.9`;
        for (let i = 0; i < MAX_GAGAL_IP; i++) await gagal(`${tanda}-n${i}`, ip, 1);
        expect(await sisaKunciLuas(`${tanda}-baru`, ip)).toBeGreaterThan(60);
        expect(await sisaKunciLuas(`${tanda}-baru`, "10.6.0.1")).toBe(0);
    });
});
