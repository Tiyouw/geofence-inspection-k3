import { z } from "zod";
import { cariLampiran, formulirDari, hapusLampiranRow } from "@/features/tanya/server";
import { sajikanLampiran } from "@/features/tanya/sajikan";
import { hapusFoto } from "@/lib/storage/photos";

async function ambil(ctx: RouteContext<"/api/tanya/[token]/lampiran/[id]">) {
    const { token, id } = await ctx.params;
    const f = formulirDari(token);
    if (!f || !z.uuid().safeParse(id).success) return null;
    const row = await cariLampiran(f, id);
    return row ? { row, f } : null;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/tanya/[token]/lampiran/[id]">) {
    const ada = await ambil(ctx);
    if (!ada) return new Response("Tidak ditemukan", { status: 404 });
    return sajikanLampiran(ada.row);
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/tanya/[token]/lampiran/[id]">) {
    const ada = await ambil(ctx);
    if (!ada) return new Response("Tidak ditemukan", { status: 404 });
    await hapusFoto(ada.row.storageKey).catch(() => {});
    await hapusLampiranRow(ada.f, ada.row.id);
    return Response.json({ dihapus: true });
}
