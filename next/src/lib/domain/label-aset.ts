/**
 * Label aset siap tampil/cetak, diterjemahkan dari app/Models/Asset.php (labelLokasi, labelMedia).
 * Dipakai stiker, dasbor, pencarian, dan laporan supaya bunyinya seragam.
 */
import { labelLantai } from "./asset";

type AsetLokasi = { lokasiTeks?: string | null; gedung?: string | null; lantai?: string | null };

/** "Lorong Timur titik 1 · Lt. 1"; jatuh ke gedung bila titik kosong; tidak pernah kosong ("-"). */
export function labelLokasi(a: AsetLokasi, pemisah = " · "): string {
  const bagian = [a.lokasiTeks?.trim() || a.gedung?.trim() || null, labelLantai(a.lantai)].filter(Boolean);
  return bagian.join(pemisah) || "-";
}

/** Nama area satu baris ("Gedung PIP · Lt. 1"): kunci pengelompokan area di dasbor dan peta. */
export function namaArea(a: Pick<AsetLokasi, "gedung" | "lantai">): string {
  return [a.gedung?.trim() || "Area belum diisi", labelLantai(a.lantai)].filter(Boolean).join(" · ");
}

/** "Powder / 6 kg": jenis media (atau tipe, atau "APAR") ditambah kapasitas bila ada. */
export function labelMedia(attributes: { jenis?: string; tipe?: string; kapasitas_kg?: number | string } | null | undefined): string {
  const media = attributes?.jenis || attributes?.tipe || "APAR";
  const kapasitas = attributes?.kapasitas_kg;
  return kapasitas != null && kapasitas !== "" ? `${media} / ${String(kapasitas).replace(".", ",")} kg` : media;
}
