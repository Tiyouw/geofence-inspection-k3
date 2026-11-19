"use client";

import { CloudUpload, History, House, ScanLine, UserRound, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/shell/brand";
import { PeranDokumen } from "@/components/shell/peran-dokumen";
import { cn } from "@/lib/utils";
import { useInspektur } from "./konteks";
import { IndikatorKoneksi } from "./status-bar";
import { TautanLapangan } from "./tautan";

type Tujuan = { href: string; label: string; Ikon: LucideIcon; cocok?: (p: string) => boolean };

/** Lima tujuan inspektur (arah A, navigasi pil mengambang dari arah C). */
export const NAV_INSPEKTUR: Tujuan[] = [
  { href: "/petugas", label: "Beranda", Ikon: House, cocok: (p) => p === "/petugas" },
  { href: "/petugas/pindai", label: "Pindai", Ikon: ScanLine, cocok: (p) => p.startsWith("/petugas/pindai") || p.startsWith("/petugas/isi") },
  { href: "/petugas/antrean", label: "Antrean", Ikon: CloudUpload },
  { href: "/petugas/riwayat", label: "Riwayat", Ikon: History },
  { href: "/petugas/profil", label: "Profil", Ikon: UserRound },
];

function JumlahAntrean() {
  const { data } = useInspektur();
  const n = data.drafts.filter((d) => d.status !== "draf").length;
  if (!n) return null;
  return (
    <span
      aria-label={`${n} dalam antrean`}
      className="absolute -top-0.5 left-[calc(50%+4px)] grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-brand-foreground tabular-nums"
    >
      {n}
    </span>
  );
}

/** Navigasi bawah berbentuk pil gelap yang mengambang di atas isi. */
function NavPil() {
  const path = usePathname();
  return (
    <nav
      aria-label="Menu petugas"
      className="fixed inset-x-3 bottom-[calc(12px+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-[30rem] rounded-full bg-primary p-1.5 shadow-[0_12px_28px_-14px_rgb(3_30_37/0.65)] print:hidden"
    >
      {NAV_INSPEKTUR.map(({ href, label, Ikon, cocok }) => {
        const aktif = cocok ? cocok(path) : path === href || path.startsWith(`${href}/`);
        return (
          // Navigasi klien saat daring; luring jatuh ke navigasi penuh lewat service worker.
          <TautanLapangan
            key={href}
            href={href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition-colors duration-(--durasi)",
              aktif ? "bg-card text-foreground" : "text-primary-foreground/70 hover:text-primary-foreground",
            )}
          >
            <Ikon className={cn("size-5", aktif && "text-foreground")} aria-hidden />
            {label}
            {href === "/petugas/antrean" && <JumlahAntrean />}
          </TautanLapangan>
        );
      })}
    </nav>
  );
}

/**
 * Kerangka PWA inspektur (arah A "Terang & Ramah"): bilah atas terang dengan status sinkron,
 * isi satu kolom ramah ponsel, navigasi pil mengambang. Palet peran lewat `data-peran`.
 */
export function KerangkaInspektur({ children }: { children: ReactNode }) {
  return (
    <div data-peran="inspektur" className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Dialog, menu, dan toast di portal <body> ikut palet dan huruf inspektur. */}
      <PeranDokumen peran="inspektur" />
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur pt-[env(safe-area-inset-top)] print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center justify-between gap-3 px-4">
          <TautanLapangan href="/petugas" className="flex items-center gap-2 text-foreground">
            <BrandMark accentPin className="size-7" />
            <span className="text-[15px] font-bold tracking-tight">Inspeksi K3</span>
          </TautanLapangan>
          <IndikatorKoneksi />
        </div>
      </header>
      <main id="isi" className="mx-auto w-full max-w-xl flex-1 px-4 pt-5 pb-32">
        {children}
      </main>
      <NavPil />
    </div>
  );
}
