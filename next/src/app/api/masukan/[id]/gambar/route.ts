import { cariMasukan } from "@/features/masukan/server";
import { AksesDitolak, assertRole } from "@/lib/auth/guards";
import { bacaFoto } from "@/lib/storage/photos";

/** Tangkapan layar lampiran masukan. Hanya admin; tidak pernah URL blob langsung. */
export async function GET(_req: Request, ctx: RouteContext<"/api/masukan/[id]/gambar">) {
    try {
        await assertRole("admin");
    } catch (e) {
        if (e instanceof AksesDitolak) return new Response("Tidak diizinkan", { status: 403 });
        throw e;
    }
    const m = await cariMasukan((await ctx.params).id);
    if (!m?.storageKey) return new Response("Tidak ditemukan", { status: 404 });
    const f = await bacaFoto(m.storageKey);
    if (!f) return new Response("Tidak ditemukan", { status: 404 });
    return new Response(f.stream, {
        headers: {
            "Content-Type": m.contentType ?? "image/jpeg",
            "Cache-Control": "private, max-age=3600",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
