"use server";

/**
 * Menaruh titik aset yang koordinatnya di luar kawasan (atau kosong) di dalam poligon area-nya
 * yang sudah disetujui (bug 19 Nov 2026: titik seed lama tampil di permukiman). Hanya admin,
 * hanya aset yang dipilih, dicatat di jejak audit dengan koordinat lama TIDAK ditampilkan.
 */
import { inArray, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { areas, assets } from "@/db/schema";
import { type GeometriArea, titikWakil } from "@/lib/geo/geometri";
import { aksiAdmin, catatAudit, type HasilAksi } from "../server/aksi";

const skema = z.object({ assetIds: z.array(z.number().int().positive()).min(1).max(500) });

export async function taruhAsetDiArea(masukan: z.input<typeof skema>): Promise<HasilAksi<{ jumlah: number; lewat: number }>> {
    return aksiAdmin(skema, masukan, async (d, user) => {
        const rows = await db
            .select({ id: assets.id, areaId: assets.areaId, polygon: areas.polygon })
            .from(assets)
            .leftJoin(areas, eq(areas.id, assets.areaId))
            .where(inArray(assets.id, d.assetIds));
        let jumlah = 0;
        await db.transaction(async (tx) => {
            for (const r of rows) {
                const t = r.polygon ? titikWakil(r.polygon as GeometriArea) : null;
                if (!t) continue;
                await tx
                    .update(assets)
                    .set({ lat: Number(t.lat.toFixed(7)), lng: Number(t.lng.toFixed(7)) })
                    .where(eq(assets.id, r.id));
                jumlah++;
            }
            await catatAudit(tx, user, "aset.taruh_di_area", "asset", "-", { jumlah, assetIds: d.assetIds });
        });
        revalidatePath("/admin");
        revalidatePath("/admin/aset");
        const lewat = d.assetIds.length - jumlah;
        return {
            ok: true,
            pesan: `${jumlah} aset ditaruh di dalam poligon area-nya${lewat ? `; ${lewat} dilewati (area tanpa poligon)` : ""}.`,
            data: { jumlah, lewat },
        };
    });
}
