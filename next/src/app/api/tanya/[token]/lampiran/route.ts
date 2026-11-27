import { head } from "@vercel/blob";
import { z } from "zod";
import {
    MAKS_LAMPIRAN,
    awalanLampiran,
    kunciLampiran,
    nomorSah,
    formulirDari,
    tambahLampiran,
} from "@/features/tanya/server";
import { simpanFoto } from "@/lib/storage/photos";

const Daftar = z.object({ nomor: z.string(), pathname: z.string().max(400), nama: z.string().min(1).max(200) });

/**
 * Dua cara:
 * - JSON {nomor, pathname, nama}: mendaftarkan berkas yang sudah diunggah langsung ke Blob.
 * - multipart (foto, nomor): unggah lewat peladen, untuk lokal/CI tanpa Blob.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/tanya/[token]/lampiran">) {
    const { token } = await ctx.params;
    const f = formulirDari(token);
    if (!f) return new Response("Tidak ditemukan", { status: 404 });

    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
        const d = Daftar.safeParse(await req.json().catch(() => null));
        if (!d.success || !nomorSah(d.data.nomor) || !d.data.pathname.startsWith(awalanLampiran(f, d.data.nomor))) {
            return Response.json({ pesan: "Isian tidak sah." }, { status: 422 });
        }
        const info = await head(d.data.pathname).catch(() => null);
        if (!info) return Response.json({ pesan: "Berkas tidak ditemukan di penyimpanan." }, { status: 422 });
        if (info.size > MAKS_LAMPIRAN) return Response.json({ pesan: "Berkas lebih dari 10 MB." }, { status: 413 });
        const l = await tambahLampiran(f, d.data.nomor, {
            storageKey: info.pathname,
            nama: d.data.nama,
            contentType: info.contentType || "application/octet-stream",
            bytes: info.size,
        });
        return Response.json(l);
    }

    const form = await req.formData().catch(() => null);
    const nomor = form?.get("nomor");
    const berkas = form?.get("berkas");
    if (!nomorSah(nomor) || !(berkas instanceof File))
        return Response.json({ pesan: "Isian tidak sah." }, { status: 422 });
    if (berkas.size > MAKS_LAMPIRAN) return Response.json({ pesan: "Berkas lebih dari 10 MB." }, { status: 413 });
    const key = kunciLampiran(f, nomor, berkas.name);
    const type = berkas.type || "application/octet-stream";
    await simpanFoto(key, new Uint8Array(await berkas.arrayBuffer()), type);
    const l = await tambahLampiran(f, nomor, {
        storageKey: key,
        nama: berkas.name.slice(0, 200),
        contentType: type,
        bytes: berkas.size,
    });
    return Response.json(l);
}
