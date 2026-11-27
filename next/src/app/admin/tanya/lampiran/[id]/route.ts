import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { cariLampiranAdmin } from "@/features/tanya/server";
import { sajikanLampiran } from "@/features/tanya/sajikan";

export async function GET(_req: Request, ctx: RouteContext<"/admin/tanya/lampiran/[id]">) {
    const user = await getCurrentUser();
    if (!user) return new Response("Belum masuk", { status: 401 });
    if (user.role !== "admin") return new Response("Akses ditolak", { status: 403 });
    const { id } = await ctx.params;
    if (!z.uuid().safeParse(id).success) return new Response("Tidak ditemukan", { status: 404 });
    const row = await cariLampiranAdmin(id);
    if (!row) return new Response("Tidak ditemukan", { status: 404 });
    return sajikanLampiran(row);
}
