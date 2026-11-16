import type { NextRequest } from "next/server";
import { bacaFilter, izinLaporan, jawabPdf, teks } from "@/features/laporan/http";
import { renderRekap } from "@/features/laporan/pdf/render";
import { ambilDataPeriode } from "@/features/laporan/queries";

export const maxDuration = 60;

/**
 * GET /laporan/temuan?tipe&tahun&bulan&gedung[&foto=0] → Rekap-Temuan-{tahun}-{bulan}.pdf.
 * Lampiran foto bukti ikut bawaan (SPEC §9 #1); foto=0 untuk versi tanpa foto.
 */
export async function GET(req: NextRequest) {
  const izin = await izinLaporan();
  if (izin instanceof Response) return izin;
  const q = req.nextUrl.searchParams;
  const f = bacaFilter(q);
  if (!f) return teks("Filter laporan tidak sah.", 422);
  const data = await ambilDataPeriode(f);
  if (!data) return teks("Tipe objek tidak dikenal.", 404);
  const pdf = await renderRekap(data, new Date(), q.get("foto") !== "0");
  return jawabPdf(pdf, `Rekap-Temuan-${f.tahun}-${String(f.bulan).padStart(2, "0")}.pdf`, q.has("unduh"));
}
