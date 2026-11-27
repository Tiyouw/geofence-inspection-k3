import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { detailTemuan } from "@/features/temuan/server";
import { DetailTemuan } from "@/features/temuan/ui";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Detail temuan" };

/** Satu temuan dan rujukannya (aset, inspeksi, foto butir, dasar hukum). Hanya dibaca. */
export default async function HalamanDetailTemuan({ params }: PageProps<"/admin/temuan/[id]">) {
    await requireRole("admin");
    const { id } = await params;
    const n = Number(id);
    if (!Number.isInteger(n) || n < 1) notFound();
    const t = await detailTemuan(n);
    if (!t) notFound();
    return (
        <>
            <PageHeader title={`Temuan ${t.asetKode}`} description={`${t.modul} · ${t.lokasi}`} />
            <DetailTemuan t={t} hrefInspeksi={(id) => `/admin/tinjauan/${id}`} hrefAset={(id) => `/admin/aset/${id}`} />
        </>
    );
}
