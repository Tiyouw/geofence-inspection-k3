/**
 * Penanganan akurasi GPS (ADR-7). `accuracy` dari Geolocation API adalah jari-jari
 * ketidakpastian dalam meter (keyakinan ~68%).
 */

export type PengaturanGerbang = {
  /** Toleransi dari tepi poligon gedung/area aset (m). */
  toleransiGedungM: number;
  /** Toleransi dari tepi poligon kawasan galangan (m). */
  toleransiKawasanM: number;
  /** Akurasi di atas angka ini dianggap lemah (m). */
  akurasiLemahM: number;
};

/** Nilai yang disetujui pemilik 17 Nov 2026; nilai resmi dibaca dari tabel `settings`. */
export const PENGATURAN_GERBANG_BAWAAN: PengaturanGerbang = {
  toleransiGedungM: 30,
  toleransiKawasanM: 50,
  akurasiLemahM: 100,
};

/** Kunci di tabel `settings` (Tech Spec, migrasi 2). */
export const KUNCI_PENGATURAN_GERBANG = {
  toleransiGedungM: "gerbang.toleransi_gedung_m",
  toleransiKawasanM: "gerbang.toleransi_kawasan_m",
  akurasiLemahM: "gerbang.akurasi_lemah_m",
} as const satisfies Record<keyof PengaturanGerbang, string>;

/** Menyusun pengaturan dari baris kunci-nilai; nilai rusak atau hilang memakai bawaan. */
export function bacaPengaturanGerbang(nilai: Record<string, unknown>): PengaturanGerbang {
  const hasil = { ...PENGATURAN_GERBANG_BAWAAN };
  for (const [k, kunci] of Object.entries(KUNCI_PENGATURAN_GERBANG) as [keyof PengaturanGerbang, string][]) {
    const n = Number(nilai[kunci]);
    if (nilai[kunci] != null && Number.isFinite(n) && n > 0) hasil[k] = n;
  }
  return hasil;
}

export type MutuAkurasi = "baik" | "lemah";

export function mutuAkurasi(akurasiM: number, p: Pick<PengaturanGerbang, "akurasiLemahM">): MutuAkurasi {
  return akurasiM > p.akurasiLemahM ? "lemah" : "baik";
}

/**
 * Toleransi tepi gedung untuk satu bacaan: min(akurasi, toleransi gedung) (PRD, aturan 3).
 * Akurasi menunjukkan seberapa jauh posisi sebenarnya bisa meleset, jadi bacaan yang
 * tepat tidak mendapat kelonggaran lebih dari galatnya, dan kelonggaran dibatasi 30 m.
 */
export function toleransiGedungEfektif(akurasiM: number, p: Pick<PengaturanGerbang, "toleransiGedungM">): number {
  return Math.min(Math.max(0, akurasiM), p.toleransiGedungM);
}

/** "±12 m" untuk teks antarmuka. */
export function labelAkurasi(akurasiM: number): string {
  return `±${Math.round(akurasiM)} m`;
}

/** Jarak untuk pesan: "35 m" atau "1,2 km". */
export function labelJarak(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km`;
}
