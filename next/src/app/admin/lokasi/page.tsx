import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/app-shell";
import { EditorArea } from "@/features/admin/components/editor-area";
import { dataEditorArea } from "@/features/admin/server/area";
import { requireRole } from "@/lib/auth/guards";
import { pengaturanGerbang } from "@/lib/geo/data";
import { PengaturanCapFoto } from "@/features/admin/components/pengaturan-cap-foto";
import { capKoordinatAktif } from "@/lib/foto/pengaturan";

export const metadata: Metadata = { title: "Lokasi & area" };

const LANGKAH = ["Gambar atau impor batas gedung", "Periksa draf di peta (garis putus-putus)", "Setujui agar mulai dipakai"];

/** Editor area (PRD "Impor denah"): poligon kawasan dan gedung di atas ubin peta dasar. */
export default async function Lokasi() {
    await requireRole("admin");
    const [data, p, capKoordinat] = await Promise.all([dataEditorArea(), pengaturanGerbang(), capKoordinatAktif()]);
    return (
        <>
            <PageHeader
                title="Lokasi & area"
                description={`Batas tiap gedung dipakai untuk mengecek apakah inspektur benar-benar berada di dekat aset. Toleransi: ${p.toleransiGedungM} m dari tepi gedung, ${p.toleransiKawasanM} m dari tepi kawasan; sinyal GPS di atas ${p.akurasiLemahM} m dianggap lemah.`}
            />
            <ol aria-label="Langkah" className="mb-4 flex flex-wrap gap-2">
                {LANGKAH.map((l, i) => (
                    <li key={l} className="flex items-center gap-2.5 rounded-full border bg-card py-1.5 pr-4 pl-1.5 text-sm font-semibold">
                        <span className="grid size-7 place-items-center rounded-full bg-primary text-xs text-primary-foreground" aria-hidden>
                            {i + 1}
                        </span>
                        {l}
                    </li>
                ))}
            </ol>
            <PengaturanCapFoto awal={capKoordinat} />
            <EditorArea area={data.area} aset={data.aset} unit={data.unit} />
        </>
    );
}
