import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { MAKS_LAMPIRAN, awalanLampiran, formulirDari, nomorSah } from "@/features/tanya/server";

/**
 * Token unggah langsung ke Vercel Blob (privat). Berkas sampai 10 MB tidak melewati fungsi
 * (batas badan permintaan Vercel 4,5 MB). Sesudah unggah, klien mendaftarkan berkas lewat
 * POST /api/tanya/{token}/lampiran, yang memeriksa berkasnya di Blob.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/tanya/[token]/unggah">) {
    const { token } = await ctx.params;
    const f = formulirDari(token);
    if (!f) return new Response("Tidak ditemukan", { status: 404 });
    const body = (await req.json()) as HandleUploadBody;
    try {
        const hasil = await handleUpload({
            body,
            request: req,
            onBeforeGenerateToken: async (pathname, clientPayload) => {
                if (!nomorSah(clientPayload) || !pathname.startsWith(awalanLampiran(f, clientPayload))) {
                    throw new Error("Lokasi berkas tidak sah.");
                }
                return { maximumSizeInBytes: MAKS_LAMPIRAN, addRandomSuffix: true, allowOverwrite: false };
            },
            onUploadCompleted: async () => {},
        });
        return Response.json(hasil);
    } catch (e) {
        return Response.json({ pesan: e instanceof Error ? e.message : "Unggahan ditolak." }, { status: 400 });
    }
}
