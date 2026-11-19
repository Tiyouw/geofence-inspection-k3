import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_ADMIN, denganLencanaMasukan, denganLencanaTinjauan } from "@/components/shell/nav";
import { PencarianPerintah } from "@/features/admin/components/pencarian-perintah";
import { jumlahAntreanTinjauan } from "@/features/admin/server/dasbor";
import { jumlahMasukanTerbuka } from "@/features/masukan/server";
import { requireRole } from "@/lib/auth/guards";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
    // Lencana menu Tinjauan = jumlah antrean (H7). Dihitung bersamaan dengan pemeriksaan peran;
    // angkanya tidak dipakai bila peran ditolak.
    const [user, antrean, masukan] = await Promise.all([requireRole("admin"), jumlahAntreanTinjauan(), jumlahMasukanTerbuka()]);
    return (
        <DesktopShell user={user} nav={denganLencanaMasukan(denganLencanaTinjauan(NAV_ADMIN, antrean), masukan)} peran="admin" atas={<PencarianPerintah />}>
            {children}
        </DesktopShell>
    );
}
