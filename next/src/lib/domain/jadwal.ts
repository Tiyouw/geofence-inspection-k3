/**
 * Aturan jadwal kewajiban inspeksi (SPEC §3.9), murni tanpa basis data.
 * Dipakai cron awal periode (sesi Laporan) dan finalisasi inspeksi (sesi Inspektur).
 *
 * Semua tanggal berupa teks "YYYY-MM-DD" di zona Asia/Jakarta, sama dengan kolom `date`.
 */
import type { ScheduleStatus } from "./constants";

/** "2026-10-17" → "2026-10-01" */
export function periodeDari(tanggal: string): string {
  return `${tanggal.slice(0, 7)}-01`;
}

/** Jumlah hari dalam bulan periode "YYYY-MM-01". */
export function hariDalamBulan(periode: string): number {
  const [y, m] = periode.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * jatuh_tempo = periode + (periode_hari − 1) hari, dibatasi akhir bulan
 * (SPEC §9 #19: Februari tidak boleh jatuh di Maret).
 */
export function jatuhTempo(periode: string, periodeHari: number): string {
  const hari = Math.max(1, Math.min(periodeHari, hariDalamBulan(periode)));
  return `${periode.slice(0, 8)}${String(hari).padStart(2, "0")}`;
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
