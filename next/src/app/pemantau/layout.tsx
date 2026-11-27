import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_PEMANTAU, denganLencanaTinjauan } from "@/components/shell/nav";
import { LencanaHanyaLihat } from "@/features/laporan/ui";
import { jumlahAntreanTinjauan } from "@/features/admin/server/dasbor";
import { requireRole } from "@/lib/auth/guards";

/**
 * Area pemantau: kerangka arah A yang sama dengan admin, dengan palet Pemantau (tema.css,
 * data-peran="pemantau") dan lencana "Hanya lihat". Admin yang membuka area ini tetap memakai palet Admin.
 * Satu-satunya aksi tulis di area ini adalah keputusan tinjauan (PRD F13); otorisasi tetap di
 * setiap halaman dan aksi. Lencana menu Tinjauan = jumlah antrean, sama dengan menu admin.
 */
export default async function PemantauLayout({ children }: LayoutProps<"/pemantau">) {
  const [user, antrean] = await Promise.all([requireRole("admin", "pemantau"), jumlahAntreanTinjauan()]);
  const pemantau = user.role === "pemantau";
  return (
    <DesktopShell
      user={user}
      nav={denganLencanaTinjauan(NAV_PEMANTAU, antrean)}
      peran={pemantau ? "pemantau" : "admin"}
      atas={
        pemantau ? (
          <div data-testid="hanya-lihat" className="flex justify-end lg:justify-start">
            <LencanaHanyaLihat />
          </div>
        ) : undefined
      }
    >
      {children}
    </DesktopShell>
  );
}
