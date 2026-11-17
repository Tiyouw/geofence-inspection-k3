/**
 * Profil laporan per modul: dasar hukum di kaki lembar, keterangan simbol, dan penanda tangan
 * per unit pemilik (PRD "Laporan"): SAT. PK untuk APAR, Hydrant, dan Mobil Pemadam; Divisi
 * Matra & K3LH untuk Kotak P3K. Jabatan penanda tangan {{Assumption}} sampai dijawab Rifaldy.
 */

export type ProfilLaporan = {
  dasarHukum: string;
  simbol: [string, string][];
  /** [peran, jabatan] untuk TandaTangan. */
  penandaTangan: [string, string][];
};

const SIMBOL_UMUM: [string, string][] = [
  ["✓", "berfungsi"],
  ["X", "tidak berfungsi"],
  ["O", "kondisi baik"],
  ["Ø", "kondisi tidak baik"],
  ["-", "tidak diperiksa"],
];

const tandaTangan = (unit: string): [string, string][] => [
  ["Diperiksa oleh", "Petugas Pemeriksa"],
  ["Mengetahui", `Kepala Unit ${unit}`],
];

export const SIMBOL_KURANG = "↓";
export const SIMBOL_KEDALUWARSA = "K";
export const SIMBOL_TIDAK_ADA = "TA";

const PROFIL: Record<string, ProfilLaporan> = {
  apar: {
    dasarHukum:
      "Permenaker No. 4 Tahun 1980 tentang syarat pemasangan dan pemeliharaan alat pemadam api ringan, serta NFPA 10 untuk periode pemeriksaan bulanan.",
    simbol: SIMBOL_UMUM,
    penandaTangan: tandaTangan("SAT. PK"),
  },
  p3k: {
    dasarHukum:
      "Permenakertrans No. PER.15/MEN/VIII/2008 tentang Pertolongan Pertama pada Kecelakaan di Tempat Kerja: Pasal 10 (kotak) dan Lampiran II (isi dan jumlah baku per tipe kotak A, B, C).",
    simbol: [
      ["O", "kondisi baik"],
      ["Ø", "kondisi tidak baik"],
      ["angka", "jumlah isi"],
      [SIMBOL_KURANG, "kurang dari baku tipe kotak"],
      [SIMBOL_KEDALUWARSA, "ada yang kedaluwarsa"],
      ["-", "tidak diperiksa"],
    ],
    penandaTangan: tandaTangan("Divisi Matra & K3LH"),
  },
  hydrant_box: {
    dasarHukum: "Checklist Hydrant bagian 1, pemeriksaan bulanan secara visual (NFPA 25; Permen PU No. 26/PRT/M/2008).",
    simbol: [
      ["O", "baik"],
      ["Ø", "rusak"],
      ["-", "tidak diperiksa"],
    ],
    penandaTangan: tandaTangan("SAT. PK"),
  },
  hydrant_pilar: {
    dasarHukum: "Checklist Hydrant bagian 1, pemeriksaan bulanan secara visual (NFPA 25; Permen PU No. 26/PRT/M/2008).",
    simbol: [
      ["O", "baik"],
      ["Ø", "rusak"],
      [SIMBOL_TIDAK_ADA, "tidak ada (pilar tanpa siamese)"],
      ["-", "tidak diperiksa"],
    ],
    penandaTangan: tandaTangan("SAT. PK"),
  },
};

/** Profil modul; modul tanpa profil memakai simbol umum dan penanda tangan SAT. PK. */
export function profilLaporan(slug: string): ProfilLaporan {
  return PROFIL[slug] ?? { dasarHukum: "", simbol: SIMBOL_UMUM, penandaTangan: tandaTangan("SAT. PK") };
}
