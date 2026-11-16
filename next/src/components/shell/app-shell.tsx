import Link from "next/link";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { SessionUser } from "@/lib/auth/guards";
import { ROLE_LABEL } from "@/lib/domain/constants";
import { Brand } from "./brand";
import type { NavItem } from "./nav";
import { NavLinks } from "./nav-link";
import { SignOutButton } from "./sign-out-button";

function UserBlock({ user }: { user: SessionUser }) {
  return (
    <div className="border-t border-sidebar-border px-3 pt-4">
      <p className="truncate text-sm font-medium text-white">{user.name}</p>
      <p className="mb-3 text-xs text-sidebar-foreground/60">
        {ROLE_LABEL[user.role]} · {user.nip}
      </p>
      <SignOutButton className="text-sidebar-foreground/80 hover:text-white" />
    </div>
  );
}

function SidebarBody({ user, nav, homeHref }: { user: SessionUser; nav: NavItem[]; homeHref: string }) {
  return (
    <div className="flex h-full flex-col gap-6 bg-sidebar px-3 py-5">
      <Link href={homeHref} className="px-2 text-white">
        <Brand accentPin />
      </Link>
      <nav aria-label="Menu utama" className="flex flex-1 flex-col gap-1">
        <NavLinks items={nav} variant="sidebar" />
      </nav>
      <UserBlock user={user} />
    </div>
  );
}

/** Kerangka desktop untuk admin dan pemantau: bilah samping gelap, isi terang. */
export function DesktopShell({ user, nav, children }: { user: SessionUser; nav: NavItem[]; children: ReactNode }) {
  const home = nav[0]?.href ?? "/";
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block">
        <SidebarBody user={user} nav={nav} homeHref={home} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-primary px-4 text-white lg:hidden">
          <Sheet>
            <SheetTrigger aria-label="Buka menu" className="-ml-1 rounded-md p-1.5 hover:bg-white/10">
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-0 p-0">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SidebarBody user={user} nav={nav} homeHref={home} />
            </SheetContent>
          </Sheet>
          <Brand accentPin compact />
          <span className="font-semibold">PAL-K3</span>
        </header>
        <main id="isi" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Kerangka ponsel untuk inspektur: bilah atas ringkas + navigasi bawah.
 * `status` menggantikan nama pengguna di bilah atas (mis. indikator koneksi);
 * `keluar` menggantikan tombol keluar bawaan (mis. versi yang memperingatkan antrean).
 */
export function MobileShell({
  user,
  nav,
  children,
  status,
  keluar,
}: {
  user: SessionUser;
  nav: NavItem[];
  children: ReactNode;
  status?: ReactNode;
  keluar?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-primary px-4 text-white">
        <Link href={(nav[0]?.href ?? "/")} className="text-white">
          <Brand accentPin compact />
        </Link>
        <div className="flex items-center gap-4">
          {status ?? <span className="max-w-40 truncate text-xs text-white/70">{user.name}</span>}
          {keluar ?? <SignOutButton className="text-white/80 hover:text-white" />}
        </div>
      </header>
      <main id="isi" className="mx-auto w-full max-w-xl flex-1 px-4 pt-5 pb-24">
        {children}
      </main>
      <nav
        aria-label="Menu petugas"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card pb-[env(safe-area-inset-bottom)]"
      >
        <NavLinks items={nav} variant="bottom" />
      </nav>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
