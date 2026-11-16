import "server-only";
import { headers } from "next/headers";
import type { z } from "zod";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { AksesDitolak, assertRole, type SessionUser } from "@/lib/auth/guards";
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
    return { ok: false, status: 422, pesan: "Periksa kembali isian yang ditandai.", galat: galatKolom(hasil.error) };
  }
  return kerja(hasil.data, user);
}

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

/** Jejak aksi penting di audit_logs (ARCHITECTURE §7). Jangan pernah menyimpan sandi atau token. */
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
    data: data ?? null,
    ip: await ipKlien(),
  });
}

/** Kode galat Postgres unique_violation. */
export function langgarUnik(e: unknown, constraint?: string): boolean {
  const err = (e as { cause?: unknown })?.cause ?? e;
  const pg = err as { code?: string; constraint?: string };
  return pg?.code === "23505" && (!constraint || (pg.constraint ?? "").includes(constraint));
}
