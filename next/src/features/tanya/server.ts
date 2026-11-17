import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { tanyaJawaban, tanyaKiriman, tanyaLampiran } from "@/db/schema";
import { PERTANYAAN } from "./pertanyaan";
import type { JawabanAda, JawabanSimpan, Lampiran } from "./types";

/** Formulir asli klien. "uji" dipakai uji E2E di dev supaya tidak mencampuri jawaban asli. */
export const FORMULIR = "rifaldy";
export const FORMULIR_UJI = "uji";
export type Formulir = typeof FORMULIR | typeof FORMULIR_UJI;
export const MAKS_LAMPIRAN = 10 * 1024 * 1024;
export const MAKS_TEKS = 20_000;

function cocok(token: string, benar: string | undefined): boolean {
    if (!benar || benar.length < 24) return false;
    const a = Buffer.from(token);
    const b = Buffer.from(benar);
    return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Token rahasia di env (repo publik, jadi token tidak boleh ada di kode): TANYA_TOKEN untuk
 * formulir klien, TANYA_TOKEN_UJI untuk uji. Tanpa env, formulir selalu 404.
 */
export function formulirDari(token: string | undefined | null): Formulir | null {
    if (!token) return null;
    if (cocok(token, process.env.TANYA_TOKEN)) return FORMULIR;
    if (cocok(token, process.env.TANYA_TOKEN_UJI)) return FORMULIR_UJI;
    return null;
}

const NOMOR_SAH = new Set(PERTANYAAN.map((p) => p.nomor));
export function nomorSah(nomor: unknown): nomor is string {
    return typeof nomor === "string" && NOMOR_SAH.has(nomor);
}

export function kunciLampiran(f: Formulir, nomor: string, nama: string): string {
    const aman =
        nama
            .normalize("NFKD")
            .replace(/[^\w.\-]+/g, "_")
            .slice(-80) || "berkas";
    return `${awalanLampiran(f, nomor)}${randomUUID().slice(0, 8)}-${aman}`;
}

export function awalanLampiran(f: Formulir, nomor: string): string {
    return `tanya/${f}/${nomor}/`;
}

export async function muatJawaban(
    f: Formulir = FORMULIR,
): Promise<{ jawaban: Record<string, JawabanAda>; dikirimPada: Date | null }> {
    const [rows, lampiran, [kirim]] = await Promise.all([
        db.select().from(tanyaJawaban).where(eq(tanyaJawaban.formulir, f)),
        db.select().from(tanyaLampiran).where(eq(tanyaLampiran.formulir, f)).orderBy(asc(tanyaLampiran.createdAt)),
        db.select().from(tanyaKiriman).where(eq(tanyaKiriman.formulir, f)).limit(1),
    ]);
    const jawaban: Record<string, JawabanAda> = {};
    const kosong = (): JawabanAda => ({
        jawaban: "",
        pilihan: null,
        pakaiBawaan: false,
        perluTanya: false,
        lampiran: [],
        diubahPada: null,
    });
    for (const r of rows) {
        jawaban[r.nomor] = {
            jawaban: r.jawaban,
            pilihan: r.pilihan,
            pakaiBawaan: r.pakaiBawaan,
            perluTanya: r.perluTanya,
            lampiran: [],
            diubahPada: r.updatedAt.toISOString(),
        };
    }
    for (const l of lampiran) {
        (jawaban[l.nomor] ??= kosong()).lampiran.push({
            id: l.id,
            nama: l.nama,
            contentType: l.contentType,
            bytes: l.bytes,
        });
    }
    return { jawaban, dikirimPada: kirim?.dikirimPada ?? null };
}

export async function simpanJawaban(f: Formulir, nomor: string, j: JawabanSimpan): Promise<Date> {
    const [row] = await db
        .insert(tanyaJawaban)
        .values({ formulir: f, nomor, ...j })
        .onConflictDoUpdate({
            target: [tanyaJawaban.formulir, tanyaJawaban.nomor],
            set: { ...j, updatedAt: new Date() },
        })
        .returning({ updatedAt: tanyaJawaban.updatedAt });
    return row.updatedAt;
}

export async function tambahLampiran(
    f: Formulir,
    nomor: string,
    l: Omit<Lampiran, "id"> & { storageKey: string },
): Promise<Lampiran> {
    const [row] = await db
        .insert(tanyaLampiran)
        .values({ formulir: f, nomor, ...l })
        .returning({ id: tanyaLampiran.id });
    return { id: row.id, nama: l.nama, contentType: l.contentType, bytes: l.bytes };
}

export async function cariLampiran(f: Formulir, id: string) {
    const [row] = await db
        .select()
        .from(tanyaLampiran)
        .where(and(eq(tanyaLampiran.id, id), eq(tanyaLampiran.formulir, f)))
        .limit(1);
    return row ?? null;
}

/** Untuk admin: lampiran formulir mana pun. */
export async function cariLampiranAdmin(id: string) {
    const [row] = await db.select().from(tanyaLampiran).where(eq(tanyaLampiran.id, id)).limit(1);
    return row ?? null;
}

export async function hapusLampiranRow(f: Formulir, id: string): Promise<void> {
    await db.delete(tanyaLampiran).where(and(eq(tanyaLampiran.id, id), eq(tanyaLampiran.formulir, f)));
}

export async function tandaiKirim(f: Formulir): Promise<Date> {
    const [row] = await db
        .insert(tanyaKiriman)
        .values({ formulir: f })
        .onConflictDoUpdate({
            target: tanyaKiriman.formulir,
            set: { dikirimPada: new Date(), jumlahKirim: sql`${tanyaKiriman.jumlahKirim} + 1`, updatedAt: new Date() },
        })
        .returning({ dikirimPada: tanyaKiriman.dikirimPada });
    return row.dikirimPada;
}
