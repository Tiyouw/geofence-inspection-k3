import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { EditorArea } from "@/features/admin/components/editor-area";
import { dataEditorArea } from "@/features/admin/server/area";
import { requireRole } from "@/lib/auth/guards";
import { pengaturanGerbang } from "@/lib/geo/data";

export const metadata: Metadata = { title: "Area dan poligon" };

/** Editor area (PRD "Impor denah"): poligon kawasan dan gedung di atas OpenStreetMap. */
export default async function Lokasi() {
    await requireRole("admin");
    const [data, p] = await Promise.all([dataEditorArea(), pengaturanGerbang()]);
    return (
        <>
            <PageHeader
                title="Area dan poligon"
                description={`Gerbang lokasi memakai poligon yang sudah disetujui. Toleransi: ${p.toleransiGedungM} m dari tepi gedung, ${p.toleransiKawasanM} m dari tepi kawasan, akurasi di atas ${p.akurasiLemahM} m dianggap lemah.`}
            />
            <EditorArea area={data.area} aset={data.aset} unit={data.unit} />
        </>
    );
}
