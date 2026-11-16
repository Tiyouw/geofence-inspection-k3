import { LABEL_KESIMPULAN, type Kesimpulan } from "@/lib/domain/constants";
import { LABEL_GERBANG } from "@/lib/domain/inspeksi";
import { cn } from "@/lib/utils";

/** Warna lencana gerbang (SPEC §3.5): hijau, kuning, merah, biru, abu. Semua lewat token. */
const NADA_GERBANG: Record<string, string> = {
  sesuai: "bg-success-soft text-success",
  perlu_review: "bg-warning-soft text-warning",
  jauh: "bg-danger-soft text-danger",
  gps_lemah: "bg-info-soft text-info",
  tidak_berlaku: "bg-muted text-muted-foreground",
  tanpa_gps: "bg-muted text-muted-foreground",
};

const NADA_KESIMPULAN: Record<Kesimpulan, string> = {
  layak: "bg-success-soft text-success",
  layak_catatan: "bg-warning-soft text-warning",
  tidak_layak: "bg-danger-soft text-danger",
};

const dasar = "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

export function LencanaGerbang({ status, className }: { status: string; className?: string }) {
  return <span className={cn(dasar, NADA_GERBANG[status] ?? NADA_GERBANG.tanpa_gps, className)}>{LABEL_GERBANG[status] ?? status}</span>;
}

export function LencanaKesimpulan({ k, className }: { k: Kesimpulan; className?: string }) {
  return <span className={cn(dasar, NADA_KESIMPULAN[k], className)}>{LABEL_KESIMPULAN[k]}</span>;
}

const NADA_SEVERITY: Record<string, string> = {
  berat: "bg-danger-soft text-danger",
  sedang: "bg-warning-soft text-warning",
  ringan: "bg-info-soft text-info",
};

export function LencanaSeverity({ s }: { s: string }) {
  return <span className={cn(dasar, NADA_SEVERITY[s])}>{s[0]!.toUpperCase() + s.slice(1)}</span>;
}
