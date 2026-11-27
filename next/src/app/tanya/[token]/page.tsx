import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BAGIAN, BAHAN_DIBAWA, CARA_MENJAWAB, PERTANYAAN } from "@/features/tanya/pertanyaan";
import { formulirDari, muatJawaban } from "@/features/tanya/server";
import { FormTanya } from "@/features/tanya/form-tanya";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Pertanyaan untuk Rifaldy",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * Formulir publik tanpa login untuk klien. Hanya bisa dibuka dengan token rahasia (env TANYA_TOKEN);
 * token salah = 404. Tidak ada di navigasi atau sitemap.
 */
export default async function TanyaPage({ params }: PageProps<"/tanya/[token]">) {
    const { token } = await params;
    const f = formulirDari(token);
    if (!f) notFound();
    const { jawaban, dikirimPada } = await muatJawaban(f);
    return (
        <FormTanya
            token={token}
            formulir={f}
            bagian={BAGIAN}
            pertanyaan={PERTANYAAN}
            caraMenjawab={CARA_MENJAWAB}
            bahan={BAHAN_DIBAWA}
            awal={jawaban}
            dikirimPadaAwal={dikirimPada?.toISOString() ?? null}
            unggahLangsung={!!process.env.BLOB_READ_WRITE_TOKEN}
        />
    );
}
