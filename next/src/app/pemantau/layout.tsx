import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_PEMANTAU } from "@/components/shell/nav";
import { LencanaHanyaLihat } from "@/features/laporan/ui";
import { jumlahAntreanTinjauan } from "@/features/admin/server/dasbor";
import { requireRole } from "@/lib/auth/guards";

/**
 * Area pemantau: tata letak sama dengan admin, tetapi bilah samping slate gelap
 * (token di globals.css, [data-area="pemantau"]) dan lencana "Hanya lihat".
 * Satu-satunya aksi tulis di area ini adalah keputusan tinjauan (PRD F13); otorisasi tetap di
 * setiap halaman dan aksi. Lencana menu Tinjauan = jumlah antrean, sama dengan menu admin.
 */
export default async function PemantauLayout({ children }: LayoutProps<"/pemantau">) {
  const [user, antrean] = await Promise.all([requireRole("admin", "pemantau"), jumlahAntreanTinjauan()]);
  const pemantau = user.role === "pemantau";
  const nav = NAV_PEMANTAU.map((n) =>
    n.href === "/pemantau/tinjauan" && antrean > 0 ? { ...n, label: `${n.label} (${antrean})` } : n,
  );
  return (
    <div data-area={pemantau ? "pemantau" : undefined}>
      <DesktopShell user={user} nav={nav}>
        {pemantau && (
          <div className="mb-3 flex justify-end" data-testid="hanya-lihat">
            <LencanaHanyaLihat />
          </div>
        )}
        {children}
      </DesktopShell>
    </div>
  );
}
