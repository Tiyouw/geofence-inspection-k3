import { timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { jalankanCronJadwal } from "@/features/laporan/jadwal";
import { terbitkan } from "@/lib/realtime/server";

export const maxDuration = 60;

function sahDariVercelCron(req: Request): boolean {
  const rahasia = process.env.CRON_SECRET;
  // Tanpa CRON_SECRET rute ini menolak semua panggilan (jangan pernah terbuka).
  if (!rahasia) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? "");
  const b = Buffer.from(`Bearer ${rahasia}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET /api/cron/jadwal: dipanggil Vercel Cron sekali sehari (vercel.json, 00:05 WIB).
 * Membuat jadwal awal periode, menautkan inspeksi yang belum tercatat, dan mencatat
 * pengingat tenggat (features/laporan/jadwal.ts). Idempoten.
 */
export async function GET(req: Request) {
  if (!sahDariVercelCron(req)) return Response.json({ galat: "Tidak diizinkan." }, { status: 401 });
  const hasil = await jalankanCronJadwal(db);
  if (Object.values(hasil.jadwalBaru).some((n) => n > 0) || hasil.ditautkan) terbitkan({ t: "jadwal" }, { staf: true, inspektur: true });
  return Response.json(hasil, { headers: { "Cache-Control": "no-store" } });
}
