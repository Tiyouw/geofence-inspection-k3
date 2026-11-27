import { z } from "zod";
import { MAKS_TEKS, formulirDari, nomorSah, simpanJawaban } from "@/features/tanya/server";
import { PERTANYAAN } from "@/features/tanya/pertanyaan";

const Body = z.object({
    nomor: z.string(),
    jawaban: z.string().max(MAKS_TEKS),
    pilihan: z.string().max(4).nullable(),
    pakaiBawaan: z.boolean(),
    perluTanya: z.boolean(),
});

/** Simpan otomatis satu jawaban (dipanggil dengan jeda dari formulir). */
export async function PUT(req: Request, ctx: RouteContext<"/api/tanya/[token]/jawaban">) {
    const { token } = await ctx.params;
    const f = formulirDari(token);
    if (!f) return new Response("Tidak ditemukan", { status: 404 });
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success || !nomorSah(parsed.data.nomor))
        return Response.json({ pesan: "Isian tidak sah." }, { status: 422 });
    const { nomor, ...j } = parsed.data;
    const p = PERTANYAAN.find((q) => q.nomor === nomor)!;
    if (j.pilihan !== null && !p.pilihan.some((x) => x.kode === j.pilihan)) {
        return Response.json({ pesan: "Pilihan tidak dikenal." }, { status: 422 });
    }
    const diubahPada = await simpanJawaban(f, nomor, j);
    return Response.json({ tersimpan: true, diubahPada: diubahPada.toISOString() });
}
