import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { inspectionPhotos, inspections } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/guards";
import { bacaFoto, bolehLihatFoto } from "@/lib/storage/photos";

/**
 * Menyajikan foto bukti privat setelah memeriksa sesi.
 * Pakai di UI sebagai <img src={`/api/foto/${photo.id}`}>.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/foto/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Belum masuk", { status: 401 });

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return new Response("Tidak ditemukan", { status: 404 });

  const [row] = await db
    .select({ key: inspectionPhotos.storageKey, contentType: inspectionPhotos.contentType, pemilik: inspections.userId })
    .from(inspectionPhotos)
    .innerJoin(inspections, eq(inspections.id, inspectionPhotos.inspectionId))
    .where(eq(inspectionPhotos.id, id))
    .limit(1);
  if (!row) return new Response("Tidak ditemukan", { status: 404 });
  if (!bolehLihatFoto(user, row.pemilik)) return new Response("Akses ditolak", { status: 403 });

  const foto = await bacaFoto(row.key);
  if (!foto) return new Response("Berkas foto hilang", { status: 404 });

  return new Response(foto.stream, {
    headers: {
      "Content-Type": row.contentType,
      ...(foto.size ? { "Content-Length": String(foto.size) } : {}),
      // Hanya peramban pemilik sesi yang boleh menyimpan; tidak di CDN.
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
