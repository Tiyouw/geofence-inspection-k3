import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_ADMIN } from "@/components/shell/nav";
import { PencarianPerintah } from "@/features/admin/components/pencarian-perintah";
import { jumlahAntreanTinjauan } from "@/features/admin/server/dasbor";
import { requireRole } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
    // Lencana menu Tinjauan = jumlah antrean (H7), ditulis di label karena menu bersama tidak punya slot lencana.
    // Dihitung bersamaan dengan pemeriksaan peran; angkanya tidak dipakai bila peran ditolak.
    const [user, antrean] = await Promise.all([requireRole("admin"), jumlahAntreanTinjauan()]);
    const nav = NAV_ADMIN.map((n) =>
        n.href === "/admin/tinjauan" && antrean > 0 ? { ...n, label: `${n.label} (${antrean})` } : n,
    );
    return (
        <DesktopShell user={user} nav={nav}>
            <div className="mb-6 flex justify-end">
                <PencarianPerintah />
            </div>
            {children}
        </DesktopShell>
    );
}
