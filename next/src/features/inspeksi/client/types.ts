import type { AsetPaket, GrupPaket, PaketKerja, TerkirimPaket } from "../server/bundle";
import type { HasilFinal } from "../server/inspeksi";
import type { Kesimpulan } from "@/lib/domain/constants";

export type { AsetPaket, GrupPaket, PaketKerja, TerkirimPaket, HasilFinal };

export type GpsBacaan = { lat: number; lng: number; accuracy: number; capturedAt: string };

export type JawabanLokal = {
  nilai?: string | null;
  nilaiAngka?: number | null;
  catatan?: string | null;
  answeredAt: string;
};

/** Status draf di perangkat (SPEC §7.9). */
export type StatusDraf = "draf" | "antre" | "perlu_tindakan";

export type DrafLokal = {
  inspectionId: string;
  assetId: number;
  /** Token yang benar-benar dipindai; dihapus setelah terkirim (SPEC §7.10). */
  token: string;
  qrVerification: "online" | "offline_cache";
  scannedAtDevice: string;
  scannedMono: number;
  status: StatusDraf;
  gps: GpsBacaan | null;
  jawaban: Record<number, JawabanLokal>;
  kesimpulan: Kesimpulan | null;
  /** true setelah inspektur menyentuh pilihan kesimpulan sendiri (SPEC §3.4). */
  kesimpulanManual: boolean;
  catatan: string;
  rekomendasi: string;
  submittedAtDevice: string | null;
  pesan: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FotoLokal = {
  photoId: string;
  inspectionId: string;
  blob: Blob;
  contentType: string;
  sha256: string;
  bytes: number;
  width: number;
  height: number;
  takenAtDevice: string;
  lat: number | null;
  lng: number | null;
  uploaded: boolean;
};

export type JenisOp = "start" | "upload-photo" | "delete-photo" | "finalize" | "discard";

export type OutboxOp = {
  /** = Idempotency-Key */
  opId: string;
  kind: JenisOp;
  inspectionId: string;
  /** Urutan global; FIFO per inspeksi. */
  seq: number;
  payload: Record<string, unknown>;
  attempts: number;
  nextAttemptAt: number;
  status: "pending" | "needs_action";
  lastError: string | null;
  errorKode: string | null;
  createdAt: number;
};

export type Terkirim = TerkirimPaket & { temuan?: HasilFinal["temuan"]; offline?: boolean };
