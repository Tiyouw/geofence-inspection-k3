/**
 * Cap foto bukti (keputusan GOA 18 Nov 2026, dapat diubah pemilik): keterangan yang DITAMPILKAN
 * di atas foto di aplikasi, layar tinjauan, dan PDF, TIDAK dibakar ke JPEG yang disimpan, supaya
 * berkas asli dan sha256-nya tetap utuh sebagai bukti.
 *
 * Isi: tanggal dan jam, area/gedung, kode aset, inspektur, status dan akurasi GPS. Koordinat
 * hanya bila pengaturan admin `foto.cap_koordinat` aktif (bawaan mati: denah bersifat rahasia).
 */
import { formatWaktu } from "@/lib/format";

/** Kunci tabel `settings`: tampilkan koordinat pada cap foto (boolean, bawaan false). */
export const SETTING_CAP_KOORDINAT = "foto.cap_koordinat";

export type DataCap = {
  /** Waktu jepret di perangkat; bila kosong, waktu unggah. */
  waktu: Date | string | null;
  area: string | null;
  kode: string;
  inspektur: string | null;
  akurasiM: number | null;
  /** Ambang akurasi lemah (pengaturan gerbang), bawaan 100 m. */
  ambangLemahM?: number;
  /** Diisi hanya bila pengaturan koordinat aktif. */
  koordinat?: { lat: number; lng: number } | null;
};

export function labelGpsCap(akurasiM: number | null, ambangLemahM = 100): string {
  if (akurasiM == null) return "Tanpa GPS";
  return `${akurasiM > ambangLemahM ? "GPS lemah" : "GPS baik"} ±${Math.round(akurasiM)} m`;
}

/** Baris teks cap, urut tampil. Dipakai komponen web dan PDF supaya isinya sama. */
export function barisCap(d: DataCap): string[] {
  const baris = [
    formatWaktu(d.waktu),
    [d.area, d.kode].filter(Boolean).join(" · "),
    [d.inspektur, labelGpsCap(d.akurasiM, d.ambangLemahM)].filter(Boolean).join(" · "),
  ];
  if (d.koordinat) baris.push(`${d.koordinat.lat.toFixed(6)}, ${d.koordinat.lng.toFixed(6)}`);
  return baris;
}

/** Nilai pengaturan dari tabel settings (jsonb): hanya `true` yang menyalakan. */
export function bacaCapKoordinat(nilai: unknown): boolean {
  return nilai === true || nilai === "true";
}
