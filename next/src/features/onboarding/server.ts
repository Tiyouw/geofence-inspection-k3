import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import type { SessionUser } from "@/lib/auth/guards";
import { sudahSelesai } from "./tur";

/** Perlu sambutan? Gagal baca (mis. migrasi belum jalan) = tidak, supaya halaman tetap tampil. */
export async function perluSambutan(user: Pick<SessionUser, "id" | "role">): Promise<boolean> {
    try {
        const [u] = await db.select({ s: users.onboardingSelesai }).from(users).where(eq(users.id, user.id)).limit(1);
        return !!u && !sudahSelesai(u.s, user.role);
    } catch {
        return false;
    }
}
