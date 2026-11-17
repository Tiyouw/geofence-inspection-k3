import { getCurrentUser } from "@/lib/auth/guards";
import { jawabanKeMarkdown } from "@/features/tanya/markdown";
import { FORMULIR, FORMULIR_UJI, muatJawaban } from "@/features/tanya/server";

/** Unduh semua jawaban klien sebagai Markdown (hanya admin). */
export async function GET(req: Request) {
    const user = await getCurrentUser();
    if (!user) return new Response("Belum masuk", { status: 401 });
    if (user.role !== "admin") return new Response("Akses ditolak", { status: 403 });
    const sp = new URL(req.url).searchParams;
    const f = sp.get("formulir") === FORMULIR_UJI ? FORMULIR_UJI : FORMULIR;
    const { jawaban, dikirimPada } = await muatJawaban(f);
    const asal = new URL(req.url).origin;
    const md = jawabanKeMarkdown(jawaban, {
        dikirimPada,
        dibuatPada: new Date(),
        urlLampiran: (id) => `${asal}/admin/tanya/lampiran/${id}`,
    });
    const unduh = sp.has("unduh");
    return new Response(md, {
        headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Cache-Control": "no-store",
            ...(unduh ? { "Content-Disposition": 'attachment; filename="jawaban-rifaldy.md"' } : {}),
        },
    });
}
