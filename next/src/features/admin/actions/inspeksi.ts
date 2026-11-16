"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { inspections } from "@/db/schema";
import { skemaCatatanReview, skemaTinjau } from "../lib/skema";
import { aksiAdmin, catatAudit, dariForm, type HasilAksi } from "../server/aksi";
import { syaratAntreanTinjauan } from "../server/dasbor";

function segarkan(id: string) {
    revalidatePath("/admin");
    revalidatePath("/admin/tinjauan");
    revalidatePath(`/admin/tinjauan/${id}`);
}

/**
 * "Tandai ditinjau" (H6): hanya admin, hanya bila masih di antrean, alasan ≥ 10 karakter.
 * Mengisi peninjau dan waktu; angka GPS dan bukti lapangan tidak pernah diubah.
 */
export async function tandaiDitinjau(_prev: unknown, fd: FormData): Promise<HasilAksi> {
    return aksiAdmin(skemaTinjau, dariForm(fd), async (d, user) => {
        const ok = await db.transaction(async (tx) => {
            const [r] = await tx
                .update(inspections)
                .set({ catatanReview: d.catatanReview, ditinjauPada: new Date(), ditinjauOleh: user.id })
                .where(and(eq(inspections.id, d.id), syaratAntreanTinjauan))
                .returning({ id: inspections.id, gate: inspections.gateStatus });
            if (!r) return false;
            await catatAudit(tx, user, "inspeksi.tinjau", "inspection", d.id, { gate: r.gate });
            return true;
        });
        if (!ok) return { ok: false, status: 409, pesan: "Inspeksi ini tidak lagi menunggu tinjauan." };
        segarkan(d.id);
        return { ok: true, pesan: "Tinjauan posisi tersimpan." };
    });
}

/** Hanya catatan_review yang boleh diubah dari panel (H5). */
export async function simpanCatatanReview(_prev: unknown, fd: FormData): Promise<HasilAksi> {
    return aksiAdmin(skemaCatatanReview, dariForm(fd), async (d, user) => {
        const ok = await db.transaction(async (tx) => {
            const [r] = await tx
                .update(inspections)
                .set({ catatanReview: d.catatanReview })
                .where(and(eq(inspections.id, d.id), eq(inspections.status, "final")))
                .returning({ id: inspections.id });
            if (!r) return false;
            await catatAudit(tx, user, "inspeksi.catatan_review", "inspection", d.id);
            return true;
        });
        if (!ok) return { ok: false, status: 404, pesan: "Inspeksi final tidak ditemukan." };
        segarkan(d.id);
        return { ok: true, pesan: "Catatan tinjauan tersimpan." };
    });
}
