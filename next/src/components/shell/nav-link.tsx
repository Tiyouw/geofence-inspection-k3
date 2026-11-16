"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav";
import { NAV_ICONS } from "./nav-icons";

export function NavLinks({ items, variant }: { items: NavItem[]; variant: "sidebar" | "bottom" }) {
  const pathname = usePathname();
  const root = items[0]?.href;
  return items.map(({ href, label, icon }) => {
    const Icon = NAV_ICONS[icon];
    const active = href === root ? pathname === href : pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          variant === "sidebar"
            ? "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground aria-[current=page]:[&_svg]:text-sidebar-primary"
            : "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground aria-[current=page]:font-semibold aria-[current=page]:text-primary",
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
        {label}
      </Link>
    );
  });
}
