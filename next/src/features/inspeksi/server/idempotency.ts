import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { syncReceipts } from "@/db/schema";
import { galat } from "./http";

/**
 * SPEC §7.5: setiap operasi outbox membawa Idempotency-Key (UUID). Kunci yang sama dengan
 * isi sama mengembalikan respons tersimpan; kunci sama dengan isi berbeda → 422.
 * Respons 5xx/401 tidak disimpan supaya bisa dicoba ulang.
 */
export async function idempoten(
  req: Request,
  userId: number,
  endpoint: string,
  body: Uint8Array,
  handler: () => Promise<Response>,
): Promise<Response> {
  const key = req.headers.get("idempotency-key");
  if (!key) return handler();
  if (!z.uuid().safeParse(key).success) return galat(400, "kunci_tidak_sah", "Idempotency-Key harus UUID.");

  const requestHash = createHash("sha256")
    .update(`${req.method} ${new URL(req.url).pathname}\n`)
    .update(body)
    .digest("hex");

  const [ada] = await db
    .select()
    .from(syncReceipts)
    .where(and(eq(syncReceipts.key, key), eq(syncReceipts.userId, userId)))
    .limit(1);
  if (ada) {
    if (ada.requestHash !== requestHash) {
      return galat(422, "kunci_dipakai_ulang", "Idempotency-Key sudah dipakai untuk permintaan lain.");
    }
    return Response.json(ada.responseBody, { status: ada.responseStatus, headers: { "Idempotent-Replay": "true" } });
  }

  const res = await handler();
  if (res.status < 500 && res.status !== 401 && res.status !== 429) {
    const responseBody = await res.clone().json().catch(() => null);
    await db
      .insert(syncReceipts)
      .values({ key, userId, endpoint, requestHash, responseStatus: res.status, responseBody })
      .onConflictDoNothing();
  }
  return res;
}
