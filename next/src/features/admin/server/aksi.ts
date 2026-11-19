import "server-only";
import { headers } from "next/headers";
import type { z } from "zod";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { AksesDitolak, assertRole, type SessionUser } from "@/lib/auth/guards";
import { PERAN_PENINJAU } from "@/lib/domain/constants";
import { peristiwaDariAudit } from "@/lib/realtime/saluran";
import { terbitkan } from "@/lib/realtime/server";
import { tanpaKoordinat } from "../lib/audit";
import { galatKolom } from "../lib/skema";

/** Hasil setiap Server Action admin; tidak pernah melempar ke klien untuk galat yang diharapkan. */
export type HasilAksi<T = undefined> =
    | { ok: true; pesan?: string; data?: T }
    | { ok: false; pesan: string; status?: number; galat?: Record<string, string[]> };

export const PESAN_AKSES = {
    401: "Sesi Anda berakhir. Silakan masuk lagi.",
    403: "Hanya Administrator K3 yang boleh melakukan tindakan ini.",
} as const;

/**
 * Pembungkus wajib setiap aksi tulis admin: otorisasi dari DB (assertRole), lalu validasi zod.
 * Menyembunyikan tombol tidak dihitung sebagai otorisasi (SPEC §1.4).
 */
export async function aksiAdmin<S extends z.ZodType, T = undefined>(
    skema: S,
    masukan: unknown,
    kerja: (data: z.output<S>, user: SessionUser) => Promise<HasilAksi<T>>,
): Promise<HasilAksi<T>> {
    let user: SessionUser;
    try {
        user = await assertRole("admin");
    } catch (e) {
        if (e instanceof AksesDitolak) return { ok: false, status: e.status, pesan: PESAN_AKSES[e.status] };
        throw e;
    }
    const hasil = skema.safeParse(masukan);
    if (!hasil.success) {
        return {
            ok: false,
            status: 422,
            pesan: "Periksa kembali isian yang ditandai.",
            galat: galatKolom(hasil.error),
        };
    }
    return kerja(hasil.data, user);
}

/**
 * Seperti aksiAdmin, untuk tinjauan inspeksi: Administrator K3 atau Pemantau (ADR-9).
 * Pemantau hanya boleh lewat pembungkus ini; semua aksi data induk tetap aksiAdmin.
 */
export async function aksiPeninjau<S extends z.ZodType, T = undefined>(
    skema: S,
    masukan: unknown,
    kerja: (data: z.output<S>, user: SessionUser) => Promise<HasilAksi<T>>,
): Promise<HasilAksi<T>> {
    let user: SessionUser;
    try {
        user = await assertRole(...PERAN_PENINJAU);
    } catch (e) {
        if (e instanceof AksesDitolak) {
            return { ok: false, status: e.status, pesan: e.status === 401 ? PESAN_AKSES[401] : PESAN_TINJAU_403 };
        }
        throw e;
    }
    const hasil = skema.safeParse(masukan);
    if (!hasil.success) {
        return { ok: false, status: 422, pesan: "Periksa kembali isian yang ditandai.", galat: galatKolom(hasil.error) };
    }
    return kerja(hasil.data, user);
}

const PESAN_TINJAU_403 = "Hanya Administrator K3 atau Pemantau yang boleh meninjau inspeksi.";

/** FormData → objek biasa untuk zod. */
export function dariForm(fd: FormData): Record<string, FormDataEntryValue> {
    return Object.fromEntries(fd.entries());
}

type DbAtauTx = Pick<typeof db, "insert">;

async function ipKlien(): Promise<string | null> {
    try {
        const h = await headers();
        return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    } catch {
        return null;
    }
}

/**
 * Jejak aksi penting di audit_logs (ARCHITECTURE §7). Jangan pernah menyimpan sandi atau token.
 * Sekaligus titik terbit peristiwa realtime (ADR K-12): terkirim setelah jawaban, jadi setelah
 * transaksi selesai. Isinya hanya jenis dan id, bukan `data`.
 */
export async function catatAudit(
    tx: DbAtauTx,
    user: Pick<SessionUser, "id">,
    aksi: string,
    entitas: string,
    entitasId: string | number,
    data?: Record<string, unknown>,
): Promise<void> {
    await tx.insert(auditLogs).values({
        userId: user.id,
        aksi,
        entitas,
        entitasId: String(entitasId),
        // Denah rahasia: koordinat dan bentuk peta tidak pernah disimpan di jejak audit.
        data: data ? (tanpaKoordinat(data) as Record<string, unknown>) : null,
        ip: await ipKlien(),
    });
    const ev = peristiwaDariAudit(aksi, String(entitasId));
    if (ev) terbitkan(ev.p, ev.s);
}

/** Kode galat Postgres unique_violation. */
export function langgarUnik(e: unknown, constraint?: string): boolean {
    const err = (e as { cause?: unknown })?.cause ?? e;
    const pg = err as { code?: string; constraint?: string };
    return pg?.code === "23505" && (!constraint || (pg.constraint ?? "").includes(constraint));
}
