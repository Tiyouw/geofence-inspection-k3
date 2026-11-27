"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { assetTypes } from "@/db/schema";
import { skemaPeriodeTipe } from "../lib/skema";
import { aksiAdmin, catatAudit, dariForm, type HasilAksi } from "../server/aksi";

/**
 * Periode inspeksi per tipe objek (APAR 30 hari mengikuti NFPA 10; dapat diubah admin, SPEC §3.3).
 * Berlaku untuk jadwal yang dibuat sesudahnya; baris jadwal yang sudah ada tidak diubah.
 */
export async function ubahPeriodeTipe(_prev: unknown, fd: FormData): Promise<HasilAksi> {
    return aksiAdmin(skemaPeriodeTipe, dariForm(fd), async (d, user) => {
        const ok = await db.transaction(async (tx) => {
            const [lama] = await tx
                .select({ p: assetTypes.periodeHari, slug: assetTypes.slug })
                .from(assetTypes)
                .where(eq(assetTypes.id, d.id));
            if (!lama) return false;
            await tx.update(assetTypes).set({ periodeHari: d.periodeHari }).where(eq(assetTypes.id, d.id));
            await catatAudit(tx, user, "tipe.ubah_periode", "asset_type", d.id, {
                slug: lama.slug,
                dari: lama.p,
                ke: d.periodeHari,
            });
            return true;
        });
        if (!ok) return { ok: false, status: 404, pesan: "Tipe objek tidak ditemukan." };
        revalidatePath("/admin/jadwal");
        return { ok: true, pesan: "Periode inspeksi tersimpan." };
    });
}
