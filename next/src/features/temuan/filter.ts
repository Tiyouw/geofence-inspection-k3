/**
 * Saringan daftar dan rekap temuan (PRD "Temuan": modul, gedung, tingkat, periode). Murni.
 * Dipakai halaman Admin K3 (/admin/temuan), Pemantau (/pemantau/temuan), dan PDF rekap temuan.
 */
import { SEVERITIES, type Severity } from "@/lib/domain/constants";

export type FilterTemuan = {
    /** Slug tipe aset (modul). */
    modul?: string;
    /** areas.id gedung/bengkel/dok tempat aset terdaftar. */
    area?: number;
    tingkat?: Severity;
    /** Tanggal temuan (WIB) "YYYY-MM-DD", inklusif. */
    dari?: string;
    sampai?: string;
    q?: string;
};

type Param = Record<string, string | string[] | undefined>;

const satu = (v: string | string[] | undefined) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const tanggal = (v: string | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export function parseFilterTemuan(sp: Param): FilterTemuan {
    const tingkat = satu(sp.tingkat);
    const area = Number(satu(sp.area));
    const modul = satu(sp.modul);
    return {
        modul: modul && /^[a-z0-9_]{1,32}$/.test(modul) ? modul : undefined,
        area: Number.isInteger(area) && area > 0 ? area : undefined,
        tingkat: tingkat && (SEVERITIES as readonly string[]).includes(tingkat) ? (tingkat as Severity) : undefined,
        dari: tanggal(satu(sp.dari)),
        sampai: tanggal(satu(sp.sampai)),
        q: satu(sp.q)?.slice(0, 80),
    };
}

/** Bentuk query string dari saringan (untuk paginasi dan tautan PDF). */
export function paramFilterTemuan(f: FilterTemuan): Record<string, string | number | undefined> {
    return { modul: f.modul, area: f.area, tingkat: f.tingkat, dari: f.dari, sampai: f.sampai, q: f.q };
}

/** "Berulang (n kali)" untuk n ≥ 2 (PRD, {{Assumption}}). */
export function labelBerulang(n: number): string | null {
    return n >= 2 ? `Berulang (${n} kali)` : null;
}

const NAMA_BULAN = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
];

function tglPanjang(t: string): string {
    const [y, m, d] = t.split("-").map(Number) as [number, number, number];
    return `${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/** Akhir bulan "YYYY-MM-DD" dari tanggal di bulan itu. */
export function akhirBulan(t: string): string {
    const [y, m] = t.split("-").map(Number) as [number, number];
    return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * Saringan rekap PDF: parameter baru (modul, area, tingkat, dari, sampai) atau parameter laporan
 * bulanan lama (tipe, tahun, bulan). Tanpa periode = bulan berjalan.
 */
export function filterRekap(sp: Param, hariIni: string): FilterTemuan & { dari: string; sampai: string } {
    const f = parseFilterTemuan(sp);
    const tipe = satu(sp.tipe);
    if (!f.modul && tipe && /^[a-z0-9_]{1,32}$/.test(tipe)) f.modul = tipe;
    const tahun = Number(satu(sp.tahun));
    const bulan = Number(satu(sp.bulan));
    let dari = f.dari;
    let sampai = f.sampai;
    if (!dari && !sampai && Number.isInteger(tahun) && tahun >= 2020 && tahun <= 2100 && bulan >= 1 && bulan <= 12) {
        dari = `${tahun}-${String(bulan).padStart(2, "0")}-01`;
        sampai = akhirBulan(dari);
    }
    dari ??= (sampai ?? hariIni).slice(0, 8) + "01";
    sampai ??= akhirBulan(dari);
    if (sampai < dari) [dari, sampai] = [sampai, dari];
    return { ...f, dari, sampai };
}

/** "1 s.d. 30 November 2026 · Gedung PIP · tingkat berat" untuk sub-judul PDF. */
export function lingkupRekap(f: FilterTemuan & { dari: string; sampai: string }, namaArea: string | null): string {
    const periode = `periode ${tglPanjang(f.dari)} s.d. ${tglPanjang(f.sampai)}`;
    return [periode, namaArea, f.tingkat ? `tingkat ${f.tingkat}` : null, f.q ? `pencarian "${f.q}"` : null]
        .filter(Boolean)
        .join(" · ");
}

/** Nama berkas: Rekap-Temuan-YYYY-MM.pdf untuk satu bulan penuh, selain itu rentang tanggal. */
export function namaBerkasRekap(f: { dari: string; sampai: string }): string {
    return f.dari.endsWith("-01") && f.sampai === akhirBulan(f.dari)
        ? `Rekap-Temuan-${f.dari.slice(0, 7)}.pdf`
        : `Rekap-Temuan-${f.dari}_${f.sampai}.pdf`;
}
