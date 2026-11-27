"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav";
import { NAV_ICONS } from "./nav-icons";

/** Butir aktif: beranda hanya bila tepat sama; menu lain juga untuk sub-halamannya. */
export function useAktif(root: string | undefined) {
  const pathname = usePathname();
  return (href: string) => (href === root ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
}

const GAYA = {
  // Bilah samping arah A: putih, label jelas, butir aktif berona warna peran.
  sidebar:
    "flex min-h-10 items-center gap-3 rounded-kontrol px-3 py-2 text-sm font-semibold text-sidebar-foreground/85 transition-colors duration-(--durasi) hover:bg-peran-sorot aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground",
  // Tab bawah ponsel untuk admin/pemantau (arah A).
  tab: "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11.5px] font-semibold text-muted-foreground transition-colors duration-(--durasi) aria-[current=page]:text-peran-utama-tua [&[aria-current=page]_.ikon]:bg-sidebar-accent",
  // Navigasi bawah petugas (belum pindah ke arah A).
  bottom:
    "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground transition-colors duration-(--durasi) aria-[current=page]:font-semibold aria-[current=page]:text-primary",
} as const;

export function NavLinks({
  items,
  variant,
  root,
}: {
  items: NavItem[];
  variant: keyof typeof GAYA;
  /** Href beranda area; bawaan butir pertama. */
  root?: string;
}) {
  const aktif = useAktif(root ?? items[0]?.href);
  return items.map(({ href, label, icon, lencana }) => {
    const Icon = NAV_ICONS[icon];
    const ikon =
      variant === "tab" ? (
        <span className="ikon grid h-7 w-13 place-items-center rounded-full transition-colors duration-(--durasi)">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : (
        <Icon className="size-[18px] shrink-0" aria-hidden />
      );
    return (
      <Link key={href} href={href} aria-current={aktif(href) ? "page" : undefined} className={cn(GAYA[variant])}>
        {ikon}
        <span className={cn(variant === "sidebar" && "flex-1 truncate")}>{label}</span>
        {lencana ? (
          <span
            className={cn(
              "rounded-full bg-danger px-2 text-[11.5px] leading-5 font-bold text-white tabular-nums",
              variant === "tab" && "absolute top-1 right-[calc(50%-26px)] px-1.5 text-[10px] leading-4",
            )}
          >
            <span className="sr-only">, antrean </span>
            {lencana}
          </span>
        ) : null}
      </Link>
    );
  });
}
