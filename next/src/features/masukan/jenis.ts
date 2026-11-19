/**
 * Masukan dari panduan (/panduan): jenis, batas, dan validasi. Murni (tanpa I/O) supaya dipakai
 * formulir di peramban, rute API, dan uji.
 */
import { z } from "zod";

export const JENIS_MASUKAN = ["bug", "aneh", "tanya", "saran"] as const;
export type JenisMasukan = (typeof JENIS_MASUKAN)[number];

export const LABEL_JENIS_MASUKAN: Record<JenisMasukan, string> = {
    bug: "Bug",
    aneh: "Terasa aneh",
    tanya: "Pertanyaan",
    saran: "Saran",
};

export const MAKS_ISI = 4000;
/** Tangkapan layar sudah diperkecil di peramban (JPEG ≤ 1600 px); batas ini jaring pengaman. */
export const MAKS_GAMBAR = 3 * 1024 * 1024;
export const TIPE_GAMBAR = ["image/jpeg", "image/png", "image/webp"] as const;

/** Pembatas laju per pengirim (hash IP) dan untuk semua pengirim. */
export const BATAS_LAJU = { perPengirim: 8, jendelaMenit: 10, globalPerJam: 120 } as const;

export const skemaMasukan = z.object({
    nama: z
        .string()
        .trim()
        .max(80, "Nama paling banyak 80 huruf.")
        .transform((s) => s || "Faldy"),
    jenis: z.enum(JENIS_MASUKAN, { message: "Pilih jenis masukan." }),
    konteks: z.string().trim().max(160).default(""),
    langkah: z
        .string()
        .trim()
        .max(64)
        .regex(/^[\w-]*$/)
        .optional()
        .transform((s) => s || null),
    isi: z
        .string()
        .trim()
        .min(3, "Tulis masukannya dulu, minimal beberapa kata.")
        .max(MAKS_ISI, `Masukan paling panjang ${MAKS_ISI} huruf.`),
});
export type MasukanBaru = z.infer<typeof skemaMasukan>;

export type PeriksaGambar = { ok: true } | { ok: false; pesan: string };
export function periksaGambar(berkas: { type: string; size: number }): PeriksaGambar {
    if (!(TIPE_GAMBAR as readonly string[]).includes(berkas.type)) return { ok: false, pesan: "Lampiran harus gambar JPG, PNG, atau WebP." };
    if (berkas.size === 0 || berkas.size > MAKS_GAMBAR) return { ok: false, pesan: "Gambar terlalu besar (maks 3 MB)." };
    return { ok: true };
}

/** Sel CSV: dikutip, tanda kutip digandakan, dan rumus spreadsheet dinetralkan (=, +, -, @). */
export function selCsv(v: unknown): string {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
}

export function barisCsv(nilai: unknown[]): string {
    return nilai.map(selCsv).join(",");
}
