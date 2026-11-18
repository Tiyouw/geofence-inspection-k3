import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_ADMIN, denganLencanaTinjauan } from "@/components/shell/nav";
import { PencarianPerintah } from "@/features/admin/components/pencarian-perintah";
import { jumlahAntreanTinjauan } from "@/features/admin/server/dasbor";
import { requireRole } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
    // Lencana menu Tinjauan = jumlah antrean (H7). Dihitung bersamaan dengan pemeriksaan peran;
    // angkanya tidak dipakai bila peran ditolak.
    const [user, antrean] = await Promise.all([requireRole("admin"), jumlahAntreanTinjauan()]);
    return (
        <DesktopShell user={user} nav={denganLencanaTinjauan(NAV_ADMIN, antrean)} peran="admin" atas={<PencarianPerintah />}>
            {children}
        </DesktopShell>
    );
}
