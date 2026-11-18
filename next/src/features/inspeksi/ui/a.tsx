import type { ReactNode } from "react";
import { IlustrasiModul, modulDari } from "@/components/ilustrasi/modul";
import { cn } from "@/lib/utils";
import type { AsetPaket } from "../client/types";

/**
 * Potongan tampilan arah A untuk layar inspektur. Bentuk dari token bersama (tema.css):
 * --a-radius-kartu, --a-radius-kontrol; warna dari palet peran (data-peran="inspektur").
 */
export const KARTU = "rounded-[var(--a-radius-kartu,16px)] border border-border/80 bg-card";
export const KONTROL = "rounded-[var(--a-radius-kontrol,10px)]";

export function Kartu({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(KARTU, "p-4", className)} {...p}>
      {children}
    </div>
  );
}

export function JudulBagian({ judul, kanan, id }: { judul: string; kanan?: ReactNode; id?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 px-0.5">
      <h2 id={id} className="text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {judul}
      </h2>
      {kanan && <span className="text-sm text-muted-foreground tabular-nums">{kanan}</span>}
    </div>
  );
}

/** Ilustrasi modul untuk satu aset paket kerja. */
export function GambarAset({ aset, ukuran = 44 }: { aset: Pick<AsetPaket, "slug" | "tipe">; ukuran?: number }) {
  return <IlustrasiModul modul={modulDari(aset.slug ?? aset.tipe)} ukuran={ukuran} />;
}

export function lokasiAset(a: Pick<AsetPaket, "lokasiTeks" | "gedung" | "lantai">) {
  return [a.gedung, a.lokasiTeks, a.lantai].filter(Boolean).join(" · ");
}

type Nada = "ok" | "warn" | "bad" | "info" | "mut";
const NADA: Record<Nada, string> = {
  ok: "bg-success-soft text-success",
  warn: "bg-warning-soft text-warning",
  bad: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  mut: "bg-muted text-muted-foreground",
};

export function Cip({ nada = "mut", className, children, ...p }: { nada?: Nada } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", NADA[nada], className)} {...p}>
      {children}
    </span>
  );
}

/** Pita pesan berikon: keadaan penting di atas isi (lokasi mati, lewat tenggat, luring). */
export function Pita({
  nada,
  ikon,
  judul,
  children,
  className,
  ...p
}: { nada: "warn" | "bad" | "info" | "ok"; ikon: ReactNode; judul: ReactNode; children?: ReactNode } & Omit<React.HTMLAttributes<HTMLDivElement>, "title">) {
  const warna = { warn: "bg-warning-soft [&>svg]:text-warning", bad: "bg-danger-soft [&>svg]:text-danger", info: "bg-info-soft [&>svg]:text-info", ok: "bg-success-soft [&>svg]:text-success" }[nada];
  return (
    <div className={cn("flex items-start gap-3 rounded-[var(--a-radius-kontrol,10px)] p-3.5 text-sm", warna, className)} {...p}>
      {ikon}
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold">{judul}</p>
        {children && <div className="text-foreground/85">{children}</div>}
      </div>
    </div>
  );
}
