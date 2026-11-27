import { formulirDari, tandaiKirim } from "@/features/tanya/server";

/** Menandai jawaban sudah dikirim. Boleh diulang; jawaban tetap bisa disunting. */
export async function POST(_req: Request, ctx: RouteContext<"/api/tanya/[token]/kirim">) {
    const { token } = await ctx.params;
    const f = formulirDari(token);
    if (!f) return new Response("Tidak ditemukan", { status: 404 });
    const dikirimPada = await tandaiKirim(f);
    return Response.json({ dikirimPada: dikirimPada.toISOString() });
}
