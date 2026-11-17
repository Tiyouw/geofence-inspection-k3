/**
 * Bentuk definisi modul inspeksi (checklist, langkah foto, unit pemilik), murni tanpa DB.
 * Dipakai seed, formulir lapangan, dan laporan, supaya satu sumber untuk butir dan bakunya.
 * Sumber: PRD "Checklist per modul" dan "Aturan bukti" butir 3.
 */
import type { AnswerType, Severity, TindakanRekomendasi, TipeKotakP3k } from "../constants";

/** Tipe kotak P3K (Permenakertrans PER.15/MEN/VIII/2008 Lampiran II/III). */
export type TipeKotak = TipeKotakP3k;

/**
 * Satu langkah kamera terpandu. Bentuk disepakati dengan sesi C (kamera) dan E (damkar).
 * `butir` berisi nilai `urut` butir checklist per tipe aset; urutan larik = urutan langkah.
 * TODO saat sesi C merge: ganti dengan impor dari ../langkah-foto.
 */
export type DefinisiLangkahFoto = { kode: string; judul: string; petunjuk?: string; butir: number[] };

export type DefinisiButir = {
  /** Urut global per tipe aset: kunci seed yang stabil. */
  urut: number;
  label: string;
  answerType: AnswerType;
  options?: string[];
  severityMap?: Record<string, Severity>;
  severityDefault: Severity;
  dasarHukum: string;
  /** Standar kondisi normal atau penjelasan untuk inspektur. */
  keterangan?: string;
  /** Tindakan yang direkomendasikan bawaan bila butir ini menjadi temuan {{Assumption}}. */
  tindakan: TindakanRekomendasi;
  /** Isi P3K: jumlah baku per tipe kotak. */
  baku?: Record<TipeKotak, number>;
  /** Isi P3K bertanda bintang: tanggal kedaluwarsa terdekat dicatat. */
  adaKedaluwarsa?: boolean;
  satuan?: string;
};

export type DefinisiGrup = { kode: string; nama: string; butir: DefinisiButir[] };

export type DefinisiModul = {
  slug: string;
  nama: string;
  /** Unit pemilik modul (PRD Roles and permissions). Kode mengikuti seed divisi sesi A. */
  pemilik: { kode: string; nama: string };
  periodeHari: number;
  isMobile: boolean;
  urut: number;
  grup: DefinisiGrup[];
  langkahFoto: DefinisiLangkahFoto[];
};

/** Semua butir modul, urut naik. */
export function semuaButir(m: DefinisiModul): DefinisiButir[] {
  return m.grup.flatMap((g) => g.butir).sort((a, b) => a.urut - b.urut);
}

/**
 * Pemeriksaan bentuk definisi: urut unik dan berurutan dari 1, setiap butir punya
 * minimal satu langkah foto, langkah tidak merujuk butir yang tidak ada.
 * Mengembalikan daftar masalah; kosong berarti sah.
 */
export function periksaDefinisi(m: DefinisiModul): string[] {
  const masalah: string[] = [];
  const butir = semuaButir(m);
  butir.forEach((b, i) => {
    if (b.urut !== i + 1) masalah.push(`${m.slug}: urut butir harus 1..n berurutan (ditemukan ${b.urut} di posisi ${i + 1}).`);
    if (b.answerType === "select" && !(b.options?.length)) masalah.push(`${m.slug}: butir ${b.urut} select tanpa pilihan.`);
    if (b.answerType === "number" && !b.baku) masalah.push(`${m.slug}: butir ${b.urut} angka tanpa baku.`);
  });
  const ada = new Set(butir.map((b) => b.urut));
  const kode = new Set<string>();
  for (const l of m.langkahFoto) {
    if (kode.has(l.kode)) masalah.push(`${m.slug}: kode langkah "${l.kode}" ganda.`);
    kode.add(l.kode);
    if (l.butir.length === 0) masalah.push(`${m.slug}: langkah "${l.kode}" tanpa butir.`);
    for (const u of l.butir) if (!ada.has(u)) masalah.push(`${m.slug}: langkah "${l.kode}" merujuk butir ${u} yang tidak ada.`);
  }
  const terpetakan = new Set(m.langkahFoto.flatMap((l) => l.butir));
  for (const b of butir) if (!terpetakan.has(b.urut)) masalah.push(`${m.slug}: butir ${b.urut} belum punya langkah foto.`);
  return masalah;
}
