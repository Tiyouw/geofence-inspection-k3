/** Label dan nada lencana untuk nilai domain di panel admin. */
import {
  LABEL_LOKASI,
  RADIUS_PER_LOKASI,
  type GateStatus,
  type LokasiTipe,
  type ScheduleStatus,
} from "@/lib/domain/constants";

export type Nada = "success" | "warning" | "danger" | "info" | "muted";

/** Inspection.php:81-103. */
export const LABEL_GERBANG: Record<GateStatus, { label: string; nada: Nada }> = {
  sesuai: { label: "Lokasi sesuai", nada: "success" },
  perlu_review: { label: "Perlu ditinjau", nada: "warning" },
  jauh: { label: "Jauh dari aset", nada: "danger" },
  gps_lemah: { label: "GPS lemah", nada: "info" },
  tidak_berlaku: { label: "Objek bergerak", nada: "muted" },
  tanpa_gps: { label: "Tanpa GPS", nada: "muted" },
};

/** "75 m (bawaan)" / "40 m (khusus)" / "tanpa gerbang" (H3). */
export function labelRadius(radiusM: number | null, lokasiTipe: LokasiTipe): string {
  if (radiusM) return `${radiusM} m (khusus)`;
  const bawaan = RADIUS_PER_LOKASI[lokasiTipe];
  return bawaan === null ? "tanpa gerbang" : `${bawaan} m (bawaan)`;
}

/** Keterangan di formulir aset yang berubah mengikuti jenis lokasi (H2). */
export function keteranganJenisLokasi(lokasiTipe: LokasiTipe): string {
  const r = RADIUS_PER_LOKASI[lokasiTipe];
  return r === null
    ? `${LABEL_LOKASI[lokasiTipe]}: gerbang GPS tidak diberlakukan.`
    : `${LABEL_LOKASI[lokasiTipe]}: radius bawaan ${r} m.`;
}

/**
 * Label jadwal (Schedule.php:66-73): Terlaksana / Terlaksana (telat) / Terlewat / Belum.
 * Terlewat = belum dan hari tenggat sudah berakhir.
 */
export function labelJadwal(
  status: ScheduleStatus,
  jatuhTempo: string,
  hariIni: string,
): { label: string; nada: Nada } {
  if (status === "selesai") return { label: "Terlaksana", nada: "success" };
  if (status === "telat") return { label: "Terlaksana (telat)", nada: "warning" };
  if (jatuhTempo < hariIni) return { label: "Terlewat", nada: "danger" };
  return { label: "Belum", nada: "muted" };
}

/** Jatuh tempo = periode + (periode_hari − 1) hari (Schedule.php:44-55; celah #19 menunggu keputusan pemilik). */
export function jatuhTempoPeriode(periode: string, periodeHari: number): string {
  const [y, m, d] = periode.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + periodeHari - 1)).toISOString().slice(0, 10);
}
