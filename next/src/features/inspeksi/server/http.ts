import "server-only";
import { AksesDitolak, assertRole, type SessionUser } from "@/lib/auth/guards";

/** Galat API dengan kode yang dibaca klien (outbox) untuk memutuskan coba ulang atau tidak. */
export class GalatApi extends Error {
  constructor(
    public readonly status: number,
    public readonly kode: string,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, { status, headers });
}

export function galat(status: number, kode: string, pesan: string, detail?: unknown): Response {
  return json({ kode, pesan, ...(detail !== undefined ? { detail } : {}) }, status);
}

/** Bungkus handler API inspektur: auth (401/403 JSON, bukan pengalihan) + pemetaan GalatApi. */
export async function apiInspektur(fn: (user: SessionUser) => Promise<Response>): Promise<Response> {
  let user: SessionUser;
  try {
    user = await assertRole("inspektur");
  } catch (e) {
    if (e instanceof AksesDitolak) {
      return e.status === 401
        ? galat(401, "sesi_habis", "Masuk lagi untuk mengirim antrean.")
        : galat(403, "tidak_berwenang", "Tidak berwenang. Hubungi Admin K3.");
    }
    throw e;
  }
  try {
    return await fn(user);
  } catch (e) {
    if (e instanceof GalatApi) return galat(e.status, e.kode, e.message, e.detail);
    throw e;
  }
}
