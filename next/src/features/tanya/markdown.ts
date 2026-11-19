import { BAGIAN, PERTANYAAN } from "./pertanyaan";
import type { JawabanAda } from "./types";

/**
 * Ekspor semua jawaban sebagai Markdown, urut dan bernomor seperti catatan, siap ditempel ke PRD.
 * Murni (tanpa I/O) supaya bisa diuji.
 */
export function jawabanKeMarkdown(
    jawaban: Record<string, JawabanAda>,
    opts: { dikirimPada: Date | null; dibuatPada: Date; urlLampiran: (id: string) => string },
): string {
    const zona = { timeZone: "Asia/Jakarta" } as const;
    const tgl = (d: Date) => d.toLocaleString("id-ID", { ...zona, dateStyle: "long", timeStyle: "short" }) + " WIB";
    const terisi = PERTANYAAN.filter((p) => adaIsi(jawaban[p.nomor])).length;
    const out: string[] = [
        "# Jawaban Rifaldy atas pertanyaan Inspeksi K3 (grill-me)",
        "",
        `Diekspor ${tgl(opts.dibuatPada)}. ${terisi} dari ${PERTANYAAN.length} pertanyaan terisi. ` +
            (opts.dikirimPada ? `Dikirim ${tgl(opts.dikirimPada)}.` : "Belum dikirim."),
        "",
    ];
    for (const b of BAGIAN) {
        out.push(`## ${b.nomor}. ${b.judul}`, "");
        for (const p of PERTANYAAN.filter((q) => q.bagian === b.nomor)) {
            const j = jawaban[p.nomor];
            out.push(`### ${p.nomor}${p.wajib ? " (WAJIB)" : ""}`, "", `> ${p.teks}`, "");
            if (!adaIsi(j)) {
                out.push(`- **Jawaban:** belum dijawab. Bawaan: ${p.bawaan} {{Assumption}}`, "");
                continue;
            }
            const pilih = j!.pilihan ? p.pilihan.find((x) => x.kode === j!.pilihan) : undefined;
            if (pilih) out.push(`- **Pilihan:** ${pilih.kode}) ${pilih.label}`);
            if (j!.pakaiBawaan) out.push(`- **Memakai bawaan:** ${p.bawaan}`);
            if (j!.jawaban.trim()) {
                const baris = j!.jawaban.trim().split("\n");
                out.push(`- **Jawaban:** ${baris[0]}`, ...baris.slice(1).map((l) => `  ${l}`));
            }
            if (j!.perluTanya) out.push("- **Perlu tanya pembimbing/perusahaan** {{Unverified}}");
            for (const l of j!.lampiran) out.push(`- Lampiran: [${l.nama}](${opts.urlLampiran(l.id)})`);
            out.push("");
        }
    }
    return out.join("\n");
}

export function adaIsi(j: JawabanAda | undefined): boolean {
    return (
        !!j && (j.jawaban.trim() !== "" || j.pilihan !== null || j.pakaiBawaan || j.perluTanya || j.lampiran.length > 0)
    );
}
