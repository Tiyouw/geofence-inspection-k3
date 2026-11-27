/**
 * Versi sesi (audit 19 Nov 2026, S18): token yang terbit sebelum sandi diganti, peran diubah, atau
 * akun dinonaktifkan tidak lagi diterima getCurrentUser. Integrasi; dilewati tanpa DATABASE_URL.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
const sesi: { user: { id: string; sesiVersi?: number } | null } = { user: null };
vi.mock("./index", () => ({ auth: async () => sesi }));

const adaDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!adaDb)("versi sesi (integrasi)", async () => {
    const { db } = await import("@/db");
    const { users } = await import("@/db/schema");
    const { eq, sql } = await import("drizzle-orm");
    const { getCurrentUser } = await import("./guards");

    it("token lama ditolak setelah versi naik; token baru diterima", async () => {
        const [u] = await db.select({ id: users.id, v: users.sesiVersi }).from(users).where(eq(users.nip, "1001"));
        expect(u).toBeTruthy();
        sesi.user = { id: String(u!.id), sesiVersi: u!.v };
        expect((await getCurrentUser())?.id).toBe(u!.id);
        await db
            .update(users)
            .set({ sesiVersi: sql`${users.sesiVersi} + 1` })
            .where(eq(users.id, u!.id));
        expect(await getCurrentUser()).toBeNull();
        sesi.user = { id: String(u!.id), sesiVersi: u!.v + 1 };
        expect((await getCurrentUser())?.id).toBe(u!.id);
    });
});
