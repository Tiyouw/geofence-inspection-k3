"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { inspections } from "@/db/schema";
import { aksiPeninjau, catatAudit, dariForm, type HasilAksi } from "@/features/admin/server/aksi";
import { HASIL_TINJAUAN } from "@/lib/domain/constants";
import { syaratAntreanTinjauan } from "./server";

const skemaPutusan = z.object({
    id: z.uuid(),
    hasil: z.enum(HASIL_TINJAUAN, { error: "Pilih Diterima atau Ditolak." }),
    catatanReview: z.preprocess(
        (v) => (typeof v === "string" ? v.trim() : v),
        z
            .string({ error: "Catatan tinjauan wajib diisi." })
            .min(10, "Catatan tinjauan minimal 10 karakter.")
            .max(2000, "Catatan tinjauan maksimal 2000 karakter."),
    ),
});

/**
 * Tinjauan inspeksi "perlu tinjauan" / "area terbatas" (PRD F13, ADR-9): Diterima atau Ditolak,
 * dengan catatan. Peninjau dan waktu dicatat; bukti lapangan tidak pernah diubah. Hanya peninjau
 * pertama yang tercatat: pembaruan bersyarat antrean, sehingga tinjauan kedua mendapat 409.
 */
export async function putuskanTinjauan(_prev: unknown, fd: FormData): Promise<HasilAksi> {
    return aksiPeninjau(skemaPutusan, dariForm(fd), async ({ id, hasil, catatanReview }, user) => {
        const ok = await db.transaction(async (tx) => {
            const [r] = await tx
                .update(inspections)
                .set({ hasilTinjauan: hasil, catatanReview, ditinjauPada: new Date(), ditinjauOleh: user.id })
                .where(and(eq(inspections.id, id), syaratAntreanTinjauan))
                .returning({ gate: inspections.gateStatus, alasan: inspections.gateAlasan, terbatas: inspections.restrictedArea });
            if (!r) return false;
            await catatAudit(tx, user, "inspeksi.tinjau", "inspection", id, {
                hasil,
                peran: user.role,
                gate: r.gate,
                alasan: r.alasan,
                areaTerbatas: r.terbatas,
            });
            return true;
        });
        if (!ok) return { ok: false, status: 409, pesan: "Inspeksi ini sudah ditinjau atau tidak lagi menunggu tinjauan." };
        for (const p of ["/admin", "/admin/tinjauan", `/admin/tinjauan/${id}`, "/pemantau", "/pemantau/tinjauan", `/pemantau/tinjauan/${id}`]) {
            revalidatePath(p);
        }
        return { ok: true, pesan: hasil === "diterima" ? "Inspeksi diterima." : "Inspeksi ditolak." };
    });
}
