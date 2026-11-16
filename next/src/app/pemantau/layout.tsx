import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_PEMANTAU } from "@/components/shell/nav";
import { LencanaHanyaLihat } from "@/features/laporan/ui";
import { requireRole } from "@/lib/auth/guards";

/**
 * Area pemantau: tata letak sama dengan admin, tetapi bilah samping slate gelap
 * (token di globals.css, [data-area="pemantau"]) dan lencana "Hanya lihat".
 * Tidak ada aksi tulis di area ini; otorisasi tetap di setiap halaman dan rute.
 */
export default async function PemantauLayout({ children }: LayoutProps<"/pemantau">) {
  const user = await requireRole("admin", "pemantau");
  const pemantau = user.role === "pemantau";
  return (
    <div data-area={pemantau ? "pemantau" : undefined}>
      <DesktopShell user={user} nav={NAV_PEMANTAU}>
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
