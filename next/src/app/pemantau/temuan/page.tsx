import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { halamanDari } from "@/features/admin/components/ui";
import { parseFilterTemuan } from "@/features/temuan/filter";
import { daftarTemuan, pilihanFilterTemuan } from "@/features/temuan/server";
import { SaringTemuan, TabelTemuan } from "@/features/temuan/ui";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Temuan" };

/**
 * Temuan lintas modul dan gedung (PRD "Temuan", ADR-4): dibuat otomatis dari butir gagal saat
 * inspeksi final, tanpa tindak lanjut. Diteruskan ke pihak terkait lewat rekap PDF.
 */
export default async function DaftarTemuan({ searchParams }: PageProps<"/pemantau/temuan">) {
    await requireRole("admin", "pemantau");
    const sp = await searchParams;
    const f = parseFilterTemuan(sp);
    const halaman = halamanDari(sp.hal);
    const [{ rows, total }, pilihan] = await Promise.all([daftarTemuan(f, halaman), pilihanFilterTemuan()]);
    return (
        <>
            <PageHeader
                title="Temuan"
                description="Butir checklist yang gagal, dicatat otomatis saat inspeksi dikirim. Rekap PDF diteruskan ke pihak terkait."
            />
            <SaringTemuan dasar="/pemantau/temuan" f={f} pilihan={pilihan} />
            <TabelTemuan rows={rows} total={total} halaman={halaman} f={f} dasar="/pemantau/temuan" />
        </>
    );
}
