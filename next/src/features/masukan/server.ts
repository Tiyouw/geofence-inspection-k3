import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { masukanPanduan } from "@/db/schema";
import { terbitkan } from "@/lib/realtime/server";
import { simpanFoto } from "@/lib/storage/photos";
import { BATAS_LAJU, type MasukanBaru } from "./jenis";

export type Masukan = typeof masukanPanduan.$inferSelect;

/**
 * Hash pengirim untuk pembatas laju: IP + garam (AUTH_SECRET), tidak bisa dibalik ke IP.
 * IP diambil dari x-forwarded-for yang diisi Vercel; lokal/tanpa header jatuh ke "lokal".
 */
export function hashPengirim(h: Headers): string {
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]!.trim() || h.get("x-real-ip") || "lokal";
    return createHash("sha256")
        .update(`masukan:${process.env.AUTH_SECRET ?? ""}:${ip}`)
        .digest("hex");
}

/** null = boleh; selain itu pesan penolakan (429). */
export async function cekBatasLaju(pengirim: string, sekarang = new Date()): Promise<string | null> {
    const sejakPengirim = new Date(sekarang.getTime() - BATAS_LAJU.jendelaMenit * 60_000);
    const sejakGlobal = new Date(sekarang.getTime() - 60 * 60_000);
    const [[a], [b]] = await Promise.all([
        db
            .select({ n: count() })
            .from(masukanPanduan)
            .where(and(eq(masukanPanduan.pengirimHash, pengirim), gte(masukanPanduan.createdAt, sejakPengirim))),
        db.select({ n: count() }).from(masukanPanduan).where(gte(masukanPanduan.createdAt, sejakGlobal)),
    ]);
    if ((a?.n ?? 0) >= BATAS_LAJU.perPengirim) {
        return `Terlalu banyak masukan dalam ${BATAS_LAJU.jendelaMenit} menit. Tunggu sebentar lalu kirim lagi.`;
    }
    if ((b?.n ?? 0) >= BATAS_LAJU.globalPerJam) return "Kotak masukan sedang penuh. Coba lagi nanti.";
    return null;
}

const EKSTENSI: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function simpanMasukan(
    m: MasukanBaru,
    meta: { pengirimHash: string; userAgent: string | null },
    gambar?: { data: Uint8Array; contentType: string } | null,
): Promise<{ id: string }> {
    const id = randomUUID();
    let storageKey: string | null = null;
    if (gambar) {
        storageKey = `masukan/${id}.${EKSTENSI[gambar.contentType] ?? "jpg"}`;
        await simpanFoto(storageKey, gambar.data, gambar.contentType);
    }
    await db.insert(masukanPanduan).values({
        id,
        ...m,
        storageKey,
        contentType: gambar?.contentType ?? null,
        bytes: gambar?.data.byteLength ?? null,
        pengirimHash: meta.pengirimHash,
        userAgent: meta.userAgent?.slice(0, 300) ?? null,
    });
    // Admin yang sedang membuka aplikasi langsung tahu (hanya jenis + id, tanpa isi).
    terbitkan({ t: "masukan", id }, { staf: true });
    return { id };
}

export async function daftarMasukan(filter: { semua?: boolean } = {}): Promise<Masukan[]> {
    return db
        .select()
        .from(masukanPanduan)
        .where(filter.semua ? undefined : eq(masukanPanduan.selesai, false))
        .orderBy(desc(masukanPanduan.createdAt))
        .limit(500);
}

export async function jumlahMasukanTerbuka(): Promise<number> {
    try {
        const [r] = await db.select({ n: count() }).from(masukanPanduan).where(eq(masukanPanduan.selesai, false));
        return r?.n ?? 0;
    } catch {
        // Lencana menu tidak boleh menjatuhkan seluruh area admin (mis. migrasi belum jalan).
        return 0;
    }
}

export async function cariMasukan(id: string): Promise<Masukan | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [r] = await db.select().from(masukanPanduan).where(eq(masukanPanduan.id, id)).limit(1);
    return r ?? null;
}
