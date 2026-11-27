import { z } from "zod";
import { apiInspektur, galat, json } from "@/features/inspeksi/server/http";
import { idempoten } from "@/features/inspeksi/server/idempotency";
import { buang } from "@/features/inspeksi/server/inspeksi";

export function DELETE(req: Request, ctx: RouteContext<"/api/inspections/[id]">) {
  return apiInspektur(async (user) => {
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) return galat(404, "tidak_ada", "Tidak ditemukan.");
    return idempoten(req, user.id, "discard", new Uint8Array(), async () => json(await buang(user, id)));
  });
}
