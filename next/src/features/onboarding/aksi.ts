"use server";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";

/**
 * Sambutan peran ini tidak ditampilkan lagi untuk akun ini (di perangkat mana pun): dipanggil saat
 * tur selesai atau "Jangan ingatkan saya lagi" dicentang. Hanya peran akun sendiri, tanpa masukan klien.
 */
export async function selesaikanOnboarding(): Promise<{ ok: true }> {
    const user = await requireUser();
    await db
        .update(users)
        .set({
            onboardingSelesai: sql`case when ${users.onboardingSelesai} ? ${user.role} then ${users.onboardingSelesai}
                else ${users.onboardingSelesai} || to_jsonb(${user.role}::text) end`,
        })
        .where(eq(users.id, user.id));
    return { ok: true };
}
