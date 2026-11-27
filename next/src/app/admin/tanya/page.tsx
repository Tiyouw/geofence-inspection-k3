import type { Metadata } from "next";
import { headers } from "next/headers";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { adaIsi, jawabanKeMarkdown } from "@/features/tanya/markdown";
import { PERTANYAAN } from "@/features/tanya/pertanyaan";
import { FORMULIR, FORMULIR_UJI, muatJawaban } from "@/features/tanya/server";
import { requireRole } from "@/lib/auth/guards";
import { formatWaktu } from "@/lib/format";
import { SalinMarkdown } from "./salin";

export const metadata: Metadata = { title: "Jawaban klien" };

/** Jawaban Rifaldy atas pertanyaan grill-me, sebagai Markdown untuk PRD. */
export default async function JawabanKlien({ searchParams }: PageProps<"/admin/tanya">) {
    await requireRole("admin");
    const uji = (await searchParams).formulir === FORMULIR_UJI;
    const { jawaban, dikirimPada } = await muatJawaban(uji ? FORMULIR_UJI : FORMULIR);
    const q = uji ? "?formulir=uji" : "";
    const h = await headers();
    const asal = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
    const md = jawabanKeMarkdown(jawaban, {
        dikirimPada,
        dibuatPada: new Date(),
        urlLampiran: (id) => `${asal}/admin/tanya/lampiran/${id}`,
    });
    const terisi = PERTANYAAN.filter((p) => adaIsi(jawaban[p.nomor])).length;
    const wajib = PERTANYAAN.filter((p) => p.wajib);
    const wajibTerisi = wajib.filter((p) => adaIsi(jawaban[p.nomor])).length;

    return (
        <>
            <PageHeader
                title={uji ? "Jawaban klien (formulir uji)" : "Jawaban klien"}
                description={`${terisi} dari ${PERTANYAAN.length} terisi, WAJIB ${wajibTerisi}/${wajib.length}. ${
                    dikirimPada ? `Dikirim ${formatWaktu(dikirimPada)}.` : "Belum dikirim."
                }`}
            />
            <div className="mb-4 flex flex-wrap gap-2">
                <SalinMarkdown teks={md} />
                <Button variant="outline" asChild>
                    <a href={`/admin/tanya/ekspor${q ? q + "&" : "?"}unduh=1`}>Unduh .md</a>
                </Button>
                <Button variant="outline" asChild>
                    <a href={`/admin/tanya/ekspor${q}`} target="_blank" rel="noopener">
                        Buka teks mentah
                    </a>
                </Button>
            </div>
            <pre className="max-h-[70dvh] overflow-auto rounded-xl border bg-card p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {md}
            </pre>
        </>
    );
}
