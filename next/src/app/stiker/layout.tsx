import { DesktopShell } from "@/components/shell/app-shell";
import { NAV_ADMIN } from "@/components/shell/nav";
import { PencarianPerintah } from "@/features/admin/components/pencarian-perintah";
import { jumlahAntreanTinjauan } from "@/features/admin/server/dasbor";
import { requireRole } from "@/lib/auth/guards";

/**
 * Lembar stiker memuat token QR: hanya admin (ARCHITECTURE K-06, SPEC §9 celah #3).
 * Kerangka sama dengan panel admin (menu samping); bilah samping dan bilah atas disembunyikan saat
 * mencetak, jadi hanya lembar label yang sampai ke kertas.
 */
export default async function StikerLayout({ children }: LayoutProps<"/stiker">) {
    const [user, antrean] = await Promise.all([requireRole("admin"), jumlahAntreanTinjauan()]);
    const nav = NAV_ADMIN.map((n) =>
        n.href === "/admin/tinjauan" && antrean > 0 ? { ...n, label: `${n.label} (${antrean})` } : n,
    );
    return (
        <DesktopShell user={user} nav={nav}>
            <div className="stiker-layar mb-6 flex justify-end">
                <PencarianPerintah />
            </div>
            {children}
        </DesktopShell>
    );
}
