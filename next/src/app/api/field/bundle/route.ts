import { paketKerja } from "@/features/inspeksi/server/bundle";
import { apiInspektur, json } from "@/features/inspeksi/server/http";

/** SPEC §7.3 butir 1: paket kerja untuk luring (aset, checklist, hash token, jam peladen). */
export function GET() {
  return apiInspektur(async (user) => json(await paketKerja(user), 200, { "Cache-Control": "no-store" }));
}
