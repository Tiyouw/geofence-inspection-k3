import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shell/app-shell";
import { qs } from "@/features/admin/components/ui";
import { detailTinjauan } from "@/features/tinjauan/server";
import { PanelTinjauan } from "@/features/tinjauan/ui";
import { requireRole } from "@/lib/auth/guards";
import { labelLokasi } from "@/lib/domain/label-aset";

export const metadata: Metadata = { title: "Tinjauan inspeksi" };

/**
 * Tinjauan satu inspeksi (PRD F13): Administrator K3 dan Pemantau melihat bukti yang sama dan
 * memutuskan Diterima atau Ditolak. Bukti lapangan tidak dapat diubah dari mana pun.
 */
export default async function HalamanTinjauan({ params }: PageProps<"/admin/tinjauan/[id]">) {
    await requireRole("admin");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) notFound();
    const d = await detailTinjauan(id);
    if (!d || d.status !== "final") notFound();
    return (
        <>
            <PageHeader
                title={`Inspeksi ${d.asetKode}`}
                description={`${d.modul} · ${labelLokasi({ lokasiTeks: d.asetLokasi, gedung: d.area ?? d.asetGedung, lantai: d.asetLantai })}`}
            />
            <PanelTinjauan d={d} hrefTemuan={`/admin/temuan${qs({ q: d.asetKode })}`} />
        </>
    );
}
