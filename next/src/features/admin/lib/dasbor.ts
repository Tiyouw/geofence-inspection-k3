/** Aturan murni dasbor admin (SPEC §4.3, §4.7). */
import type { Kesimpulan } from "@/lib/domain/constants";
import { labelLokasi, namaArea } from "@/lib/domain/label-aset";

/** Hanya empat nilai ini yang diterima (Dasbor.php #[Locked]). */
export const TAB_ANTREAN = ["berat", "lewat", "posisi", "belum"] as const;
export type TabAntrean = (typeof TAB_ANTREAN)[number];
export const PER_HALAMAN_ANTREAN = 6;

export const LABEL_TAB: Record<TabAntrean, string> = {
  berat: "Temuan berat",
  lewat: "Lewat tenggat",
  posisi: "Tinjauan posisi",
  belum: "Belum diperiksa",
};

/** undefined → bawaan "berat"; nilai di luar daftar → null (halaman membalas 404). */
export function parseTab(nilai: string | string[] | undefined): TabAntrean | null {
  if (nilai === undefined) return "berat";
  return typeof nilai === "string" && (TAB_ANTREAN as readonly string[]).includes(nilai) ? (nilai as TabAntrean) : null;
}

/** Nomor halaman sah 1..terakhir. Halaman yang kosong setelah entri terakhir diproses dikoreksi ke halaman terakhir. */
export function halamanAman(diminta: unknown, total: number, per: number): { halaman: number; terakhir: number } {
  const terakhir = Math.max(1, Math.ceil(total / per));
  const n = Math.floor(Number(diminta));
  const halaman = Number.isFinite(n) && n >= 1 ? Math.min(n, terakhir) : 1;
  return { halaman, terakhir };
}

/** Satu desimal, 0 bila tanpa aset. */
export function persen(bagian: number, total: number): number {
  return total ? Math.round((bagian / total) * 1000) / 10 : 0;
}

export type StatusTitik = Kesimpulan | "belum" | "tanpa_kesimpulan";

export type AsetPeta = {
  id: number;
  kode: string;
  gedung: string | null;
  lantai: string | null;
  lokasiTeks: string | null;
  lat: number | null;
  lng: number | null;
  /** Kesimpulan inspeksi final terakhir bulan ini; undefined = belum diperiksa. */
  kesimpulan?: Kesimpulan | null;
  sudahDiperiksa: boolean;
  tinjau: boolean;
};

/** Hanya kolom yang perlu digambar. Tidak ada token QR (SPEC §3.1, I6). */
export type TitikPeta = {
  id: number;
  kode: string;
  area: string;
  lokasi: string;
  lat: number;
  lng: number;
  status: StatusTitik;
  tinjau: boolean;
};

/** Aset tanpa koordinat dihitung di tanpaTitik, tidak digambar. */
export function titikPeta(aset: AsetPeta[]): { titik: TitikPeta[]; tanpaTitik: number } {
  const titik: TitikPeta[] = [];
  for (const a of aset) {
    if (a.lat == null || a.lng == null) continue;
    titik.push({
      id: a.id,
      kode: a.kode,
      area: namaArea(a),
      lokasi: labelLokasi(a),
      lat: a.lat,
      lng: a.lng,
      status: a.sudahDiperiksa ? (a.kesimpulan ?? "tanpa_kesimpulan") : "belum",
      tinjau: a.tinjau,
    });
  }
  return { titik, tanpaTitik: aset.length - titik.length };
}

/**
 * Batas tampilan peta. Satu titik atau titik berkoordinat sama dilebarkan ±5e-5 derajat
 * supaya rentang tidak nol (tidak membagi dengan nol saat diproyeksikan).
 */
export function batasPeta(titik: { lat: number; lng: number }[]): [[number, number], [number, number]] | null {
  if (titik.length === 0) return null;
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  for (const t of titik) {
    s = Math.min(s, t.lat);
    n = Math.max(n, t.lat);
    w = Math.min(w, t.lng);
    e = Math.max(e, t.lng);
  }
  const PAD = 5e-5;
  if (n - s < PAD) [s, n] = [s - PAD, n + PAD];
  if (e - w < PAD) [w, e] = [w - PAD, e + PAD];
  return [
    [s, w],
    [n, e],
  ];
}
