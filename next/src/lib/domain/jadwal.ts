/**
 * Aturan jadwal kewajiban inspeksi (SPEC §3.9), murni tanpa basis data.
 * Dipakai cron awal periode (sesi Laporan) dan finalisasi inspeksi (sesi Inspektur).
 *
 * Semua tanggal berupa teks "YYYY-MM-DD" di zona Asia/Jakarta, sama dengan kolom `date`.
 */
import type { ScheduleStatus } from "./constants";

/** periodeDari dan jatuhTempo (min(periode + n − 1, akhir bulan), §9 #19) dari inspeksi.ts. */
export { jatuhTempo, periodeDari } from "./inspeksi";

/** Jumlah hari dalam bulan periode "YYYY-MM-01". */
export function hariDalamBulan(periode: string): number {
  const [y, m] = periode.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * Status jadwal setelah inspeksi final: `selesai` bila tanggal inspeksi (WIB)
 * ≤ akhir hari jatuh tempo, selain itu `telat` (SPEC §3.9).
 */
export function statusSetelahInspeksi(tanggalInspeksi: string, tempo: string): Exclude<ScheduleStatus, "belum"> {
  return tanggalInspeksi <= tempo ? "selesai" : "telat";
}

export type LabelJadwal = "Belum" | "Terlewat" | "Terlaksana" | "Terlaksana (telat)";

/** Label tampilan (SPEC §3.9): `belum` yang tenggatnya sudah lewat dibaca "Terlewat". */
export function labelJadwal(status: ScheduleStatus, tempo: string, hariIni: string): LabelJadwal {
  if (status === "selesai") return "Terlaksana";
  if (status === "telat") return "Terlaksana (telat)";
  return hariIni > tempo ? "Terlewat" : "Belum";
}

/** Sisa hari menuju tenggat (negatif bila sudah lewat). */
export function sisaHari(hariIni: string, tempo: string): number {
  const ms = Date.parse(`${tempo}T00:00:00Z`) - Date.parse(`${hariIni}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
