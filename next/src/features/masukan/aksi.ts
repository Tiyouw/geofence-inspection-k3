"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { masukanPanduan } from "@/db/schema";
import { catatAudit } from "@/features/admin/server/aksi";
import { requireRole } from "@/lib/auth/guards";

/** Tandai masukan selesai ditangani (atau buka lagi). Hanya admin; tercatat di jejak audit. */
export async function tandaiMasukan(id: string, selesai: boolean): Promise<{ ok: boolean }> {
    const user = await requireRole("admin");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false };
    await db.transaction(async (tx) => {
        const r = await tx
            .update(masukanPanduan)
            .set({ selesai, selesaiPada: selesai ? new Date() : null, selesaiOleh: selesai ? user.id : null })
            .where(eq(masukanPanduan.id, id))
            .returning({ id: masukanPanduan.id });
        if (r.length) await catatAudit(tx, user, selesai ? "masukan.selesai" : "masukan.buka", "masukan", id);
    });
    revalidatePath("/admin/masukan");
    return { ok: true };
}
