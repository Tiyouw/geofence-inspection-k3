/**
 * Format tanggal dan angka khusus dokumen laporan. Bentuknya mengikuti PDF Laravel
 * (Carbon `translatedFormat`, locale id) supaya keluaran v2 identik dengan
 * docs/v2/samples: "02 Nov 2026 09:00", "01 Okt 2026", "01/10", "04/10/26", "85,7".
 * Semua dalam zona Asia/Jakarta.
 */
import { TIMEZONE } from "@/lib/domain/constants";

export const NAMA_BULAN = [
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
] as const;

/** Singkatan bulan Carbon (locale id), bukan Intl ("Agt", bukan "Agu"). */
const BULAN_SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"] as const;

type Bagian = { y: number; m: number; d: number; hh: string; mm: string };

const fmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Pecah waktu menjadi bagian kalender di Jakarta. String "YYYY-MM-DD" dibaca apa adanya. */
export function bagianJakarta(v: Date | string): Bagian {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number) as [number, number, number];
    return { y, m, d, hh: "00", mm: "00" };
  }
  const p = Object.fromEntries(fmt.formatToParts(new Date(v)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: p.hour!, mm: p.minute! };
}

const dua = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" di Jakarta. */
export function tanggalIso(v: Date | string): string {
  const b = bagianJakarta(v);
  return `${b.y}-${dua(b.m)}-${dua(b.d)}`;
}

/** 01/10 */
export const tglDm = (v: Date | string) => {
  const b = bagianJakarta(v);
  return `${dua(b.d)}/${dua(b.m)}`;
};
/** 04/10/26 */
export const tglDmy2 = (v: Date | string) => {
  const b = bagianJakarta(v);
  return `${dua(b.d)}/${dua(b.m)}/${String(b.y).slice(-2)}`;
};
/** 01/10/2026 */
export const tglDmy = (v: Date | string) => {
  const b = bagianJakarta(v);
  return `${dua(b.d)}/${dua(b.m)}/${b.y}`;
};
/** 01 Okt 2026 */
export const tglSingkat = (v: Date | string) => {
  const b = bagianJakarta(v);
  return `${dua(b.d)} ${BULAN_SINGKAT[b.m - 1]} ${b.y}`;
};
/** 02 November 2026 */
export const tglPanjang = (v: Date | string) => {
  const b = bagianJakarta(v);
  return `${dua(b.d)} ${NAMA_BULAN[b.m - 1]} ${b.y}`;
};
/** 02 Nov 2026 09:00 */
export const waktuCetak = (v: Date | string) => {
  const b = bagianJakarta(v);
  return `${tglSingkat(v)} ${b.hh}:${b.mm}`;
};
/** 01/10/2026 09:15 */
export const waktuDmyHm = (v: Date | string) => {
  const b = bagianJakarta(v);
  return `${tglDmy(v)} ${b.hh}:${b.mm}`;
};

/** Oktober 2026 */
export const namaPeriode = (tahun: number, bulan: number) => `${NAMA_BULAN[bulan - 1]} ${tahun}`;

/** 85,7 (satu desimal, koma; seperti number_format($x, 1, ',', '.')) */
export function persen1(n: number): string {
  const [bulat, pecahan] = (Math.round(n * 10) / 10).toFixed(1).split(".") as [string, string];
  return `${bulat.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${pecahan}`;
}

/** "Berat" dari "berat" (ucfirst). */
export const kapital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
