import { z } from "zod";
import { apiInspektur, galat, json } from "@/features/inspeksi/server/http";
import { idempoten } from "@/features/inspeksi/server/idempotency";
import { finalisasi, finalizeSchema } from "@/features/inspeksi/server/inspeksi";

export function POST(req: Request, ctx: RouteContext<"/api/inspections/[id]/finalize">) {
  return apiInspektur(async (user) => {
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) return galat(404, "tidak_ada", "Tidak ditemukan.");
    const raw = new Uint8Array(await req.arrayBuffer());
    return idempoten(req, user.id, "finalize", raw, async () => {
      let body: unknown;
      try {
        body = JSON.parse(new TextDecoder().decode(raw));
      } catch {
        return galat(400, "json", "Isi permintaan bukan JSON.");
      }
      const parsed = finalizeSchema.safeParse(body);
      if (!parsed.success) return galat(422, "validasi", "Data inspeksi tidak sah.", parsed.error.issues);
      return json(await finalisasi(user, id, parsed.data));
    });
  });
}
