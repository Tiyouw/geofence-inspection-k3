import { LABEL_JENIS_MASUKAN, barisCsv, type JenisMasukan } from "@/features/masukan/jenis";
import { daftarMasukan } from "@/features/masukan/server";
import { requireRole } from "@/lib/auth/guards";

/** Semua masukan sebagai CSV (UTF-8 dengan BOM supaya Excel membaca huruf dengan benar). */
export async function GET() {
    await requireRole("admin");
    const rows = await daftarMasukan({ semua: true });
    const isi = [
        barisCsv(["waktu", "nama", "jenis", "slide", "isi", "ada_gambar", "selesai", "selesai_pada"]),
        ...rows.map((m) =>
            barisCsv([
                m.createdAt.toISOString(),
                m.nama,
                LABEL_JENIS_MASUKAN[m.jenis as JenisMasukan] ?? m.jenis,
                m.konteks,
                m.isi,
                m.storageKey ? "ya" : "tidak",
                m.selesai ? "ya" : "tidak",
                m.selesaiPada?.toISOString() ?? "",
            ]),
        ),
    ].join("\r\n");
    const tgl = new Date().toISOString().slice(0, 10);
    return new Response("﻿" + isi, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="masukan-panduan-${tgl}.csv"`,
            "Cache-Control": "no-store",
        },
    });
}
