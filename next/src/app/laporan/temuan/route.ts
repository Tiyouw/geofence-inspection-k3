import type { NextRequest } from "next/server";
import { izinLaporan, jawabPdf } from "@/features/laporan/http";
import { tanggalIso } from "@/features/laporan/format";
import { renderRekap } from "@/features/laporan/pdf/render";
import { filterRekap, namaBerkasRekap } from "@/features/temuan/filter";
import { isiRekapTemuan } from "@/features/temuan/server";

export const maxDuration = 60;

/**
 * GET /laporan/temuan?modul&area&tingkat&dari&sampai&q[&foto=0] → PDF rekap temuan (PRD "Laporan").
 * Parameter laporan bulanan lama (tipe, tahun, bulan) tetap diterima. Lampiran foto ikut bawaan;
 * foto=0 untuk versi tanpa foto.
 */
export async function GET(req: NextRequest) {
    const izin = await izinLaporan();
    if (izin instanceof Response) return izin;
    const q = req.nextUrl.searchParams;
    const now = new Date();
    const f = filterRekap(Object.fromEntries(q), tanggalIso(now));
    const isi = await isiRekapTemuan(f);
    const pdf = await renderRekap(isi, now, q.get("foto") !== "0");
    return jawabPdf(pdf, namaBerkasRekap(f), q.has("unduh"));
}
