import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_ADMIN, NAV_PEMANTAU } from "@/components/shell/nav";
import { PencarianPerintah } from "@/features/admin/components/pencarian-perintah";
import { LencanaHanyaLihat } from "@/features/laporan/ui";
import { requireRole } from "@/lib/auth/guards";

/**
 * Halaman /laporan memakai kerangka peran yang membukanya: menu dan palet Admin untuk admin,
 * menu dan palet Pemantau untuk pemantau. Rute PDF di bawahnya (route.ts) tidak memakai layout ini
 * dan memeriksa peran sendiri.
 */
export default async function LaporanLayout({ children }: LayoutProps<"/laporan">) {
  const user = await requireRole("admin", "pemantau");
  if (user.role === "admin") {
    return (
      <DesktopShell user={user} nav={NAV_ADMIN} peran="admin" atas={<PencarianPerintah />}>
        {children}
      </DesktopShell>
    );
  }
  return (
    <DesktopShell
      user={user}
      nav={NAV_PEMANTAU}
      peran="pemantau"
      atas={
        <div data-testid="hanya-lihat" className="flex justify-end lg:justify-start">
          <LencanaHanyaLihat />
        </div>
      }
    >
      {children}
    </DesktopShell>
  );
}
