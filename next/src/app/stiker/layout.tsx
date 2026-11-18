import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_ADMIN, denganLencanaTinjauan } from "@/components/shell/nav";
import { PencarianPerintah } from "@/features/admin/components/pencarian-perintah";
import { jumlahAntreanTinjauan } from "@/features/admin/server/dasbor";
import { requireRole } from "@/lib/auth/guards";

/**
 * Lembar stiker memuat token QR: hanya admin (ARCHITECTURE K-06, SPEC §9 celah #3).
 * Kerangka sama dengan panel admin; bilah samping, bilah atas, dan tab bawah disembunyikan saat
 * mencetak, jadi hanya lembar label yang sampai ke kertas.
 */
export default async function StikerLayout({ children }: LayoutProps<"/stiker">) {
    const [user, antrean] = await Promise.all([requireRole("admin"), jumlahAntreanTinjauan()]);
    return (
        <DesktopShell user={user} nav={denganLencanaTinjauan(NAV_ADMIN, antrean)} peran="admin" atas={<PencarianPerintah />}>
            {children}
        </DesktopShell>
    );
}
