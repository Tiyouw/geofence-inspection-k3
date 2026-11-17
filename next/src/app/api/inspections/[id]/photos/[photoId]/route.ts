import { z } from "zod";
import { apiInspektur, galat, json } from "@/features/inspeksi/server/http";
import { idempoten } from "@/features/inspeksi/server/idempotency";
import { hapusFotoDraf, unggahFoto } from "@/features/inspeksi/server/inspeksi";

type Ctx = RouteContext<"/api/inspections/[id]/photos/[photoId]">;

const angka = (v: string | null) => (v === null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** SPEC §7.4/§7.11: badan JPEG mentah, idempoten per photoId. */
export function PUT(req: Request, ctx: Ctx) {
  return apiInspektur(async (user) => {
    const { id, photoId } = await ctx.params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(photoId).success) {
      return galat(404, "tidak_ada", "Tidak ditemukan.");
    }
    const body = new Uint8Array(await req.arrayBuffer());
    return idempoten(req, user.id, "photo", body, async () => {
      const h = req.headers;
      const hasil = await unggahFoto(user, id, photoId, body, {
        contentType: (h.get("content-type") ?? "").split(";")[0]!.trim(),
        sha256: h.get("x-sha256"),
        takenAt: h.get("x-taken-at"),
        lat: angka(h.get("x-lat")),
        lng: angka(h.get("x-lng")),
        akurasi: angka(h.get("x-accuracy")),
        langkah: h.get("x-step")?.slice(0, 64) || null,
        width: angka(h.get("x-width")),
        height: angka(h.get("x-height")),
      });
      return json(hasil);
    });
  });
}

export function DELETE(req: Request, ctx: Ctx) {
  return apiInspektur(async (user) => {
    const { id, photoId } = await ctx.params;
    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(photoId).success) {
      return galat(404, "tidak_ada", "Tidak ditemukan.");
    }
    return idempoten(req, user.id, "photo-delete", new Uint8Array(), async () => json(await hapusFotoDraf(user, id, photoId)));
  });
}
