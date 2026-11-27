import type { NextRequest } from "next/server";
import { bacaFilter, izinLaporan, jawabPdf, teks } from "@/features/laporan/http";
import { renderPms } from "@/features/laporan/pdf/render";
import { ambilDataPeriode } from "@/features/laporan/queries";

export const maxDuration = 60;

/** GET /laporan/pms?tipe&tahun&bulan&gedung → PMS-{TIPE}-{tahun}-{bulan}.pdf (SPEC §4.9, ACCEPTANCE L1/L3). */
export async function GET(req: NextRequest) {
  const izin = await izinLaporan();
  if (izin instanceof Response) return izin;
  const f = bacaFilter(req.nextUrl.searchParams);
  if (!f) return teks("Filter laporan tidak sah.", 422);
  const data = await ambilDataPeriode(f);
  if (!data) return teks("Tipe objek tidak dikenal.", 404);
  const pdf = await renderPms(data, new Date());
  const nama = `PMS-${f.tipe.toUpperCase()}-${f.tahun}-${String(f.bulan).padStart(2, "0")}.pdf`;
  return jawabPdf(pdf, nama, req.nextUrl.searchParams.has("unduh"));
}
