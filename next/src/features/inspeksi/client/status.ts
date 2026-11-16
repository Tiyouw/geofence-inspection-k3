import type { DrafLokal, OutboxOp } from "./types";

export type StatusAntrean = { label: string; nada: "info" | "warning" | "danger"; perluTindakan: boolean };

/** Label status satu inspeksi di antrean (SPEC §7.9). */
export function statusAntrean(
  draf: DrafLokal,
  ops: OutboxOp[],
  foto: { total: number; terunggah: number } | undefined,
  daring: boolean,
  now = Date.now(),
): StatusAntrean {
  const milik = ops.filter((o) => o.inspectionId === draf.inspectionId);
  const macet = milik.find((o) => o.status === "needs_action");
  if (draf.status === "perlu_tindakan" || macet) {
    return { label: `Perlu tindakan: ${draf.pesan ?? macet?.lastError ?? "periksa kembali"}`, nada: "danger", perluTindakan: true };
  }
  if (milik.some((o) => o.errorKode === "sesi_habis")) {
    return { label: "Masuk lagi untuk mengirim antrean", nada: "danger", perluTindakan: true };
  }
  if (!daring) return { label: "Menunggu sinyal", nada: "warning", perluTindakan: false };
  const tertunda = milik.filter((o) => o.attempts > 0 && o.nextAttemptAt > now);
  if (tertunda.length) {
    const detik = Math.max(1, Math.ceil((Math.min(...tertunda.map((o) => o.nextAttemptAt)) - now) / 1000));
    return { label: `Gagal, coba lagi ${detik} dtk`, nada: "warning", perluTindakan: false };
  }
  if (foto && foto.total > 0 && foto.terunggah < foto.total && milik.some((o) => o.kind === "upload-photo")) {
    return { label: `Mengirim foto ${foto.terunggah + 1}/${foto.total}`, nada: "info", perluTindakan: false };
  }
  return { label: "Mengirim…", nada: "info", perluTindakan: false };
}
