"use server";

/**
 * Pengaturan cap foto (keputusan GOA 18 Nov 2026): koordinat pada cap foto bawaan mati karena
 * denah bersifat rahasia; Administrator K3 dapat menyalakannya. Cap hanya lapisan tampilan.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { SETTING_CAP_KOORDINAT } from "@/lib/foto/cap";
import { aksiAdmin, catatAudit, type HasilAksi } from "../server/aksi";

const skema = z.object({ aktif: z.boolean() });

export async function ubahCapKoordinat(masukan: z.input<typeof skema>): Promise<HasilAksi> {
    return aksiAdmin(skema, masukan, async (d, user) => {
        await db.transaction(async (tx) => {
            await tx
                .insert(settings)
                .values({ kunci: SETTING_CAP_KOORDINAT, nilai: d.aktif, keterangan: "Tampilkan koordinat pada cap foto bukti", diubahOleh: user.id })
                .onConflictDoUpdate({ target: settings.kunci, set: { nilai: d.aktif, diubahOleh: user.id } });
            await catatAudit(tx, user, "pengaturan.cap_koordinat", "pengaturan", SETTING_CAP_KOORDINAT, { aktif: d.aktif });
        });
        revalidatePath("/admin/lokasi");
        return { ok: true, pesan: d.aktif ? "Koordinat ditampilkan pada cap foto." : "Koordinat disembunyikan dari cap foto." };
    });
}
