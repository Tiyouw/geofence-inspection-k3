/**
 * Aturan jadwal kewajiban inspeksi (SPEC §3.9), murni tanpa basis data.
 * Dipakai cron awal periode (sesi Laporan) dan finalisasi inspeksi (sesi Inspektur).
 *
 * Semua tanggal berupa teks "YYYY-MM-DD" di zona Asia/Jakarta, sama dengan kolom `date`.
 */
import type { ScheduleStatus } from "./constants";
import { jatuhTempo as jatuhTempoBulan, periodeDari as periodeDariBulan } from "./inspeksi";

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

/* ---------- periode per tipe aset (PRD F16: bulanan; mingguan untuk mobil pemadam) ---------- */

/** periode_hari yang dijadwalkan per minggu; selain ini per bulan kalender. */
export const PERIODE_MINGGUAN_HARI = 7;

export function mingguan(periodeHari: number): boolean {
  return periodeHari === PERIODE_MINGGUAN_HARI;
}

/** Senin pada minggu tanggal "YYYY-MM-DD" (minggu dimulai Senin, zona WIB sudah dalam teks). */
export function awalMinggu(tanggal: string): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  const mundur = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - mundur);
  return d.toISOString().slice(0, 10);
}

/** Periode jadwal sebuah tanggal: Senin awal minggu untuk tipe mingguan, tanggal 1 untuk lainnya. */
export function periodeUntuk(tanggal: string, periodeHari: number): string {
  return mingguan(periodeHari) ? awalMinggu(tanggal) : periodeDariBulan(tanggal);
}

/** Jatuh tempo periode: Minggu akhir pekan untuk tipe mingguan, aturan bulanan untuk lainnya. */
export function jatuhTempoUntuk(periode: string, periodeHari: number): string {
  if (!mingguan(periodeHari)) return jatuhTempoBulan(periode, periodeHari);
  const d = new Date(`${periode}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Periode sebelum `periode` (minggu atau bulan sebelumnya). */
export function periodeSebelum(periode: string, periodeHari: number): string {
  const d = new Date(`${periode}T00:00:00Z`);
  if (mingguan(periodeHari)) d.setUTCDate(d.getUTCDate() - 7);
  else d.setUTCMonth(d.getUTCMonth() - 1, 1);
  return d.toISOString().slice(0, 10);
}

/** Rentang waktu sebuah periode sebagai instan UTC [awal, akhir), batas hari WIB. */
export function rentangPeriode(periode: string, periodeHari: number): { awal: Date; akhir: Date } {
  const WIB = 7 * 3_600_000;
  const akhir = new Date(`${periode}T00:00:00Z`);
  if (mingguan(periodeHari)) akhir.setUTCDate(akhir.getUTCDate() + 7);
  else akhir.setUTCMonth(akhir.getUTCMonth() + 1, 1);
  return { awal: new Date(Date.parse(`${periode}T00:00:00Z`) - WIB), akhir: new Date(akhir.getTime() - WIB) };
}

/**
 * Periode yang dimulai di bulan "YYYY-MM-01": satu (bulan itu) untuk tipe bulanan, atau setiap
 * Senin di bulan itu untuk tipe mingguan. Dipakai tampilan jadwal dan laporan per bulan.
 */
export function periodeDalamBulan(bulan: string, periodeHari: number): string[] {
  if (!mingguan(periodeHari)) return [bulan.slice(0, 8) + "01"];
  const out: string[] = [];
  let p = awalMinggu(bulan.slice(0, 8) + "01");
  if (p < bulan.slice(0, 8) + "01") p = tambahHariTeks(p, 7);
  while (p.slice(0, 7) === bulan.slice(0, 7)) {
    out.push(p);
    p = tambahHariTeks(p, 7);
  }
  return out;
}

function tambahHariTeks(tanggal: string, n: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
