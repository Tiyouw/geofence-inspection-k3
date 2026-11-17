import type { NextRequest } from "next/server";
import { namaPeriode } from "@/features/laporan/format";
import { bacaFilter, izinLaporan, jawabPdf, teks } from "@/features/laporan/http";
import { renderRekapP3k } from "@/features/laporan/pdf/render";
import { ambilRekapP3k } from "@/features/laporan/queries-p3k";

export const maxDuration = 60;

/** GET /laporan/isi-p3k?tahun&bulan&gedung → Rekap-Isi-P3K-{tahun}-{bulan}.pdf (PRD "Laporan"). */
export async function GET(req: NextRequest) {
  const izin = await izinLaporan();
  if (izin instanceof Response) return izin;
  const f = bacaFilter(req.nextUrl.searchParams);
  if (!f) return teks("Filter laporan tidak sah.", 422);
  const rekap = await ambilRekapP3k(f);
  if (!rekap) return teks("Modul Kotak P3K belum ada.", 404);
  const pdf = await renderRekapP3k(rekap, namaPeriode(f.tahun, f.bulan), f.gedung, new Date());
  return jawabPdf(pdf, `Rekap-Isi-P3K-${f.tahun}-${String(f.bulan).padStart(2, "0")}.pdf`, req.nextUrl.searchParams.has("unduh"));
}
