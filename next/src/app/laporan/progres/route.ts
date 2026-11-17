import type { NextRequest } from "next/server";
import { laporanProgresGedung } from "@/features/dasbor/laporan";
import { NAMA_BULAN, tanggalIso } from "@/features/laporan/format";
import { izinLaporan, jawabPdf, teks } from "@/features/laporan/http";
import { renderProgres } from "@/features/laporan/pdf/render";
import { kolomTandaTangan } from "@/features/temuan/rekap";

export const maxDuration = 60;

/**
 * GET /laporan/progres?[tahun&bulan][&modul] → PDF "Progres per gedung" (PRD F15).
 * Tanpa tahun/bulan: periode berjalan tiap modul, sama persis dengan dasbor. Dengan tahun dan
 * bulan: semua periode yang dimulai di bulan itu (mobil pemadam per minggu).
 */
export async function GET(req: NextRequest) {
    const izin = await izinLaporan();
    if (izin instanceof Response) return izin;
    const q = req.nextUrl.searchParams;
    const now = new Date();
    const tahun = q.get("tahun");
    const bulan = q.get("bulan");
    const modul = q.get("modul") || undefined;
    if (modul && !/^[a-z0-9_]{1,32}$/.test(modul)) return teks("Filter laporan tidak sah.", 422);
    let bulanIso: string | undefined;
    if (tahun || bulan) {
        const t = Number(tahun);
        const b = Number(bulan);
        if (!Number.isInteger(t) || t < 2020 || t > 2100 || !Number.isInteger(b) || b < 1 || b > 12) {
            return teks("Filter laporan tidak sah.", 422);
        }
        bulanIso = `${t}-${String(b).padStart(2, "0")}-01`;
    }
    const data = await laporanProgresGedung({ bulan: bulanIso, modul }, now);
    if (modul && data.modul.length === 0) return teks("Tipe objek tidak dikenal.", 404);
    const judulPeriode = bulanIso
        ? `periode ${NAMA_BULAN[Number(bulanIso.slice(5, 7)) - 1]} ${bulanIso.slice(0, 4)}`
        : "periode berjalan (sama dengan dasbor)";
    const pdf = await renderProgres(
        {
            data,
            judulPeriode,
            judulModul: modul ? data.modul[0]!.nama : "Semua modul",
            tandaTangan: kolomTandaTangan(data.unit),
        },
        now,
    );
    const nama = bulanIso ? `Progres-Gedung-${bulanIso.slice(0, 7)}.pdf` : `Progres-Gedung-berjalan-${tanggalIso(now)}.pdf`;
    return jawabPdf(pdf, nama, q.has("unduh"));
}
