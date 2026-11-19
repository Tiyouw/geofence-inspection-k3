import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { halamanDari } from "@/features/admin/components/ui";
import { daftarTinjauan, hitungTinjauan, parseTabTinjauan } from "@/features/tinjauan/server";
import { TabAntrean, TabelAntrean } from "@/features/tinjauan/ui";
import { requireRole } from "@/lib/auth/guards";
import { PERAN_PENINJAU } from "@/lib/domain/constants";

export const metadata: Metadata = { title: "Tinjauan" };

/** Antrean tinjauan bersama (PRD F13): "perlu tinjauan" dan "area terbatas", terlama dulu. */
export default async function AntreanTinjauan({ searchParams }: PageProps<"/pemantau/tinjauan">) {
    await requireRole(...PERAN_PENINJAU);
    const sp = await searchParams;
    const tab = parseTabTinjauan(sp.tab);
    const halaman = halamanDari(sp.hal);
    const [data, angka] = await Promise.all([daftarTinjauan(tab, halaman), hitungTinjauan()]);
    return (
        <>
            <PageHeader
                title="Tinjauan"
                description="Inspeksi dengan posisi di luar gedung aset, GPS lemah, atau di area terbatas. Satu tinjauan per inspeksi, oleh Administrator K3 atau Pemantau."
            />
            <TabAntrean dasar="/pemantau/tinjauan" tab={tab} menunggu={angka.menunggu} />
            <TabelAntrean data={data} tab={tab} halaman={halaman} dasar="/pemantau/tinjauan" />
        </>
    );
}
