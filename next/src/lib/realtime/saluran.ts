/**
 * Lapisan realtime (ADR K-12): siapa mendengar saluran apa, dan halaman mana yang terdampak.
 * Murni (tanpa I/O): dipakai peladen (penerbit, otorisasi langganan) dan klien (penyaring).
 *
 * Peristiwa hanya memuat jenis dan id. Tidak pernah koordinat, nama, isi jawaban, atau data
 * rahasia lain: klien yang menerimanya menyegarkan data lewat jalur biasa yang sudah diotorisasi.
 */
import type { Role } from "@/lib/domain/constants";

export const JENIS_PERISTIWA = ["inspeksi", "tinjauan", "jadwal", "aset", "area", "pengguna", "masukan"] as const;
export type JenisPeristiwa = (typeof JENIS_PERISTIWA)[number];

/** Isi pesan di kabel. `id` hanya dikirim ke saluran staf (admin/pemantau). */
export type Peristiwa = { t: JenisPeristiwa; id?: string };

/** Yang boleh diketahui peramban: alamat peladen saja (kunci API tidak pernah keluar). Kosong = Ably. */
export type KonfigurasiKlienRealtime = { endpoint?: string; port?: number; tls?: boolean };

/** Nama pesan Ably untuk semua peristiwa data. */
export const NAMA_EVENT = "berubah";

/** Siapa yang perlu tahu. */
export type Sasaran = {
    /** admin dan pemantau (melihat seluruh galangan). */
    staf?: boolean;
    /** semua inspektur: data bersama paket kerja (aset, area, jadwal). Tanpa id. */
    inspektur?: boolean;
    /** inspektur satu unit kerja. Tanpa id. */
    unit?: number | null;
    /** pengguna tertentu (mis. akun yang diubah). Tanpa id. */
    pengguna?: (number | null | undefined)[];
};

export const SALURAN_STAF = "palk3:staf";
export const SALURAN_INSPEKTUR = "palk3:inspektur";
export const saluranUnit = (id: number) => `palk3:unit:${id}`;
export const saluranPengguna = (id: number) => `palk3:pengguna:${id}`;

/** Saluran yang boleh didengar pengguna ini. Dihitung di peladen dari data DB, bukan dari klien. */
export function saluranUntuk(u: { id: number; role: Role; divisionId: number | null }): string[] {
    if (u.role === "admin" || u.role === "pemantau") return [SALURAN_STAF, saluranPengguna(u.id)];
    return [SALURAN_INSPEKTUR, ...(u.divisionId ? [saluranUnit(u.divisionId)] : []), saluranPengguna(u.id)];
}

/** Kapabilitas token Ably: hanya "subscribe" pada saluran yang disebut (tanpa wildcard, tanpa publish). */
export function kapabilitas(saluran: string[]): Record<string, ["subscribe"]> {
    return Object.fromEntries(saluran.map((c) => [c, ["subscribe"]]));
}

export function bolehBerlangganan(u: Parameters<typeof saluranUntuk>[0], saluran: string): boolean {
    return saluranUntuk(u).includes(saluran);
}

/**
 * Pesan per saluran: staf menerima id, saluran lain hanya jenisnya, supaya tidak ada id
 * inspeksi/aset unit lain yang bocor ke inspektur.
 */
export function pesanUntukSasaran(p: Peristiwa, s: Sasaran): { saluran: string; data: Peristiwa }[] {
    const keluar: { saluran: string; data: Peristiwa }[] = [];
    if (s.staf) keluar.push({ saluran: SALURAN_STAF, data: p });
    const tanpaId: Peristiwa = { t: p.t };
    if (s.inspektur) keluar.push({ saluran: SALURAN_INSPEKTUR, data: tanpaId });
    else if (s.unit) keluar.push({ saluran: saluranUnit(s.unit), data: tanpaId });
    for (const id of new Set(s.pengguna ?? [])) if (id) keluar.push({ saluran: saluranPengguna(id), data: tanpaId });
    return keluar;
}

/**
 * Peristiwa dari baris jejak audit aksi admin (catatAudit). Hampir semua penulisan admin
 * tercatat di sana, jadi satu titik ini mencakup aset, area, jadwal, pengguna, dan tinjauan.
 * `null` = aksi yang tidak mengubah data yang ditampilkan (mis. melihat token).
 */
export function peristiwaDariAudit(aksi: string, entitasId: string): { p: Peristiwa; s: Sasaran } | null {
    const [awal] = aksi.split(".");
    const bersama: Sasaran = { staf: true, inspektur: true };
    if (aksi === "aset.lihat_token") return null;
    if (aksi === "inspeksi.tinjau") return { p: { t: "tinjauan", id: entitasId }, s: { staf: true } };
    if (awal === "aset") return { p: { t: "aset", id: entitasId }, s: bersama };
    if (awal === "area" || awal === "pengaturan") return { p: { t: "area", id: entitasId }, s: bersama };
    if (awal === "jadwal" || awal === "tipe") return { p: { t: "jadwal", id: entitasId }, s: bersama };
    if (awal === "masukan") return { p: { t: "masukan", id: entitasId }, s: { staf: true } };
    if (awal === "pengguna") {
        const id = Number(entitasId);
        return { p: { t: "pengguna", id: entitasId }, s: { staf: true, pengguna: Number.isInteger(id) ? [id] : [] } };
    }
    return null;
}

/** Awalan halaman yang menampilkan data jenis ini. */
const AWALAN: Record<JenisPeristiwa, string[]> = {
    inspeksi: ["/admin", "/pemantau", "/laporan"],
    tinjauan: ["/admin", "/pemantau", "/laporan"],
    jadwal: ["/admin", "/pemantau", "/laporan"],
    aset: ["/admin", "/pemantau", "/laporan"],
    area: ["/admin", "/pemantau"],
    pengguna: ["/admin"],
    /** Masukan dari /panduan: lencana menu admin dan halaman /admin/masukan. */
    masukan: ["/admin"],
};

/** Apakah peristiwa ini mengubah halaman pada jalur tersebut. */
export function terdampak(t: JenisPeristiwa, path: string): boolean {
    return (AWALAN[t] ?? []).some((a) => path === a || path.startsWith(`${a}/`));
}

export function bacaPeristiwa(data: unknown): Peristiwa | null {
    let x = data;
    if (typeof x === "string") {
        try {
            x = JSON.parse(x);
        } catch {
            return null;
        }
    }
    const o = x as { t?: unknown; id?: unknown } | null;
    if (!o || typeof o.t !== "string" || !(JENIS_PERISTIWA as readonly string[]).includes(o.t)) return null;
    return { t: o.t as JenisPeristiwa, ...(typeof o.id === "string" ? { id: o.id } : {}) };
}
