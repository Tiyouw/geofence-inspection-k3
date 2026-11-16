import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_ADMIN, NAV_PEMANTAU } from "@/components/shell/nav";
import { LencanaHanyaLihat } from "@/features/laporan/ui";
import { requireRole } from "@/lib/auth/guards";

/**
 * Halaman /laporan memakai kerangka peran yang membukanya: menu Admin untuk admin,
 * menu dan bilah slate Pemantau untuk pemantau. Rute PDF di bawahnya (route.ts)
 * tidak memakai layout ini dan memeriksa peran sendiri.
 */
export default async function LaporanLayout({ children }: LayoutProps<"/laporan">) {
  const user = await requireRole("admin", "pemantau");
  if (user.role === "admin") {
    return (
      <DesktopShell user={user} nav={NAV_ADMIN}>
        {children}
      </DesktopShell>
    );
  }
  return (
    <div data-area="pemantau">
      <DesktopShell user={user} nav={NAV_PEMANTAU}>
        <div className="mb-3 flex justify-end" data-testid="hanya-lihat">
          <LencanaHanyaLihat />
        </div>
        {children}
      </DesktopShell>
    </div>
  );
}
