import Link from "next/link";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { SessionUser } from "@/lib/auth/guards";
import { ROLE_LABEL } from "@/lib/domain/constants";
import { formatTanggal } from "@/lib/format";
import { Brand } from "./brand";
import type { NavItem } from "./nav";
import { NavLinks } from "./nav-link";
import { PeranDokumen } from "./peran-dokumen";
import { SignOutButton } from "./sign-out-button";

function inisial(nama: string) {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function UserBlock({ user }: { user: SessionUser }) {
  return (
    <div className="flex items-center gap-3 border-t border-sidebar-border px-2 pt-4">
      <span
        aria-hidden
        className="grid size-9 shrink-0 place-items-center rounded-full bg-sidebar-accent text-[13px] font-bold text-sidebar-accent-foreground"
      >
        {inisial(user.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {ROLE_LABEL[user.role]} · {user.nip}
        </p>
      </div>
      <SignOutButton ringkas className="rounded-kontrol p-2 text-muted-foreground hover:bg-peran-sorot hover:text-foreground" />
    </div>
  );
}

/** Menu dikelompokkan per `grup` dengan judul kecil (arah A). */
function MenuBerkelompok({ nav }: { nav: NavItem[] }) {
  const root = nav[0]?.href;
  const grup: { judul: string | undefined; items: NavItem[] }[] = [];
  for (const n of nav) {
    const akhir = grup.at(-1);
    if (akhir && akhir.judul === n.grup) akhir.items.push(n);
    else grup.push({ judul: n.grup, items: [n] });
  }
  return grup.map((g, i) => (
    <div key={g.judul ?? i} className="flex flex-col gap-0.5">
      {g.judul && (
        <p className="px-3 pt-3 pb-1.5 text-[11.5px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
          {g.judul}
        </p>
      )}
      <NavLinks items={g.items} variant="sidebar" root={root} />
    </div>
  ));
}

function SidebarBody({ user, nav, homeHref }: { user: SessionUser; nav: NavItem[]; homeHref: string }) {
  return (
    <div className="flex h-full flex-col gap-4 border-r border-sidebar-border bg-sidebar px-3.5 py-5 text-sidebar-foreground">
      <Link href={homeHref} className="px-2 text-sidebar-foreground">
        <Brand accentPin />
      </Link>
      <nav aria-label="Menu utama" className="-mx-1 flex flex-1 flex-col gap-1 overflow-y-auto px-1">
        <MenuBerkelompok nav={nav} />
      </nav>
      <UserBlock user={user} />
    </div>
  );
}

export type PeranKerangka = "admin" | "pemantau";

/**
 * Kerangka admin dan pemantau (arah A "Terang & Ramah"): bilah samping putih berlabel dan berkelompok,
 * bilah atas berisi `atas` (mis. pencarian) dan tanggal. Di ponsel: bilah atas ringkas dan tab bawah
 * (butir `bawah`) dengan "Lainnya" untuk sisa menu. Palet mengikuti `peran` (tema.css, data-peran).
 */
export function DesktopShell({
  user,
  nav,
  peran,
  atas,
  children,
}: {
  user: SessionUser;
  nav: NavItem[];
  peran: PeranKerangka;
  atas?: ReactNode;
  children: ReactNode;
}) {
  const home = nav[0]?.href ?? "/";
  const bawah = nav.filter((n) => n.bawah);
  const lainnya = nav.filter((n) => !n.bawah);
  const hariIni = formatTanggal(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div data-peran={peran} className="flex min-h-dvh">
      <PeranDokumen peran={peran} />
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block print:hidden">
        <SidebarBody user={user} nav={nav} homeHref={home} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-4 lg:relative lg:h-16 lg:bg-background lg:px-8 print:hidden">
          <Link href={home} className="text-foreground lg:hidden">
            <Brand accentPin compact />
          </Link>
          <div className="flex min-w-0 flex-1 justify-end lg:justify-start">{atas}</div>
          <span className="hidden shrink-0 text-sm text-muted-foreground lg:block">{hariIni}</span>
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-[13px] font-bold text-accent-foreground lg:hidden"
          >
            {inisial(user.name)}
          </span>
        </header>
        <main id="isi" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <nav
        aria-label="Menu bawah"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-card px-1 pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
      >
        <NavLinks items={bawah} variant="tab" root={home} />
        {lainnya.length > 0 && (
          <Sheet>
            <SheetTrigger className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11.5px] font-semibold text-muted-foreground">
              <span className="grid h-7 w-13 place-items-center">
                <Menu className="size-5" aria-hidden />
              </span>
              Lainnya
            </SheetTrigger>
            <SheetContent side="bottom" data-peran={peran} className="rounded-t-dialog border-0 p-4 pb-8">
              <SheetTitle className="px-3 pb-2 text-base">Menu lainnya</SheetTitle>
              <nav aria-label="Menu lainnya" className="flex flex-col gap-0.5">
                <NavLinks items={lainnya} variant="sidebar" root={home} />
              </nav>
              <div className="mt-3 border-t pt-3">
                <UserBlock user={user} />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </nav>
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
