/** Format tanggal/angka dengan locale Indonesia dan zona Asia/Jakarta, konsisten di server dan klien. */
import { LOCALE, TIMEZONE } from "@/lib/domain/constants";

type Tgl = Date | string | number | null | undefined;

const toDate = (v: Tgl) => (v == null ? null : v instanceof Date ? v : new Date(v));

/** 16 November 2026 */
export function formatTanggal(v: Tgl, opts: Intl.DateTimeFormatOptions = { dateStyle: "long" }): string {
  const d = toDate(v);
  return d ? new Intl.DateTimeFormat(LOCALE, { timeZone: TIMEZONE, ...opts }).format(d) : "-";
}

/** 16 Nov 2026, 14.05 WIB */
export function formatWaktu(v: Tgl): string {
  const d = toDate(v);
  if (!d) return "-";
  return (
    new Intl.DateTimeFormat(LOCALE, {
      timeZone: TIMEZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d) + " WIB"
  );
}

export function formatAngka(n: number | null | undefined, digits = 0): string {
  return n == null ? "-" : new Intl.NumberFormat(LOCALE, { maximumFractionDigits: digits }).format(n);
}

/** Tanggal hari ini di Jakarta sebagai YYYY-MM-DD (untuk kolom date). */
export function hariIniJakarta(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(now);
}
