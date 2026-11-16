/**
 * Transformasi murni SQLite Laravel → Postgres v2 (SPEC §2.4, §8). Diuji di peta.test.ts.
 */
import { createHash } from "node:crypto";
import {
  ANSWER_TYPES,
  GATE_STATUSES,
  ISSUE_STATUSES,
  KESIMPULAN,
  LOKASI_TIPE,
  ROLES,
  SCHEDULE_STATUSES,
  SEVERITIES,
} from "../../src/lib/domain/constants";

/**
 * Namespace UUIDv5 milik proyek (SPEC §8.2): tetap, tidak rahasia. Mengubahnya membuat
 * id inspeksi hasil migrasi berbeda, jadi jangan diubah setelah migrasi produksi.
 */
export const NS_PAL_K3 = "6f1c2b0e-5d3a-4c8e-9b7f-2a4d6e8f0c11";

/** UUIDv5 (RFC 4122, SHA-1) tanpa pustaka tambahan. */
export function uuidv5(nama: string, ns: string = NS_PAL_K3): string {
  const nsBytes = Buffer.from(ns.replace(/-/g, ""), "hex");
  if (nsBytes.length !== 16) throw new Error(`Namespace UUID tidak sah: ${ns}`);
  const h = createHash("sha1").update(nsBytes).update(Buffer.from(nama, "utf8")).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

export const idInspeksi = (id: number) => uuidv5(`inspection:${id}`);
export const idJawaban = (id: number) => uuidv5(`answer:${id}`);
export const idFoto = (id: number) => uuidv5(`photo:${id}`);

/**
 * SQLite Laravel menyimpan waktu lokal tanpa zona ("2026-10-01 09:00:00", APP_TIMEZONE
 * Asia/Jakarta) {{Belum diverifikasi}} untuk data live: cek satu baris (SPEC §8.3).
 * Nilai yang sudah membawa zona/“Z” dihormati apa adanya.
 */
export function waktuWib(v: string | null | undefined): Date | null {
  if (v == null || v === "") return null;
  const t = v.trim().replace(" ", "T");
  const berzona = /(Z|[+-]\d{2}:?\d{2})$/.test(t);
  const d = new Date(berzona ? t : `${t}+07:00`);
  if (Number.isNaN(d.getTime())) throw new Error(`Waktu tidak sah: ${v}`);
  return d;
}

/** Kolom date Laravel ("2026-10-30" atau "2026-10-30 00:00:00") → "YYYY-MM-DD". */
export function tanggal(v: string | null | undefined): string | null {
  if (v == null || v === "") return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v.trim());
  if (!m) throw new Error(`Tanggal tidak sah: ${v}`);
  return m[1]!;
}

export const bool = (v: unknown) => v === 1 || v === "1" || v === true;

export function json<T>(v: string | null | undefined): T | null {
  if (v == null || v === "") return null;
  return JSON.parse(v) as T;
}

/** Nilai di luar enum v2 dilaporkan, bukan ditebak. */
export class NilaiTakDikenal extends Error {
  constructor(
    public readonly kolom: string,
    public readonly nilai: unknown,
  ) {
    super(`${kolom}: nilai "${String(nilai)}" di luar enum v2`);
  }
}

function dalam<T extends string>(kolom: string, daftar: readonly T[], v: unknown): T {
  if (typeof v === "string" && (daftar as readonly string[]).includes(v)) return v as T;
  throw new NilaiTakDikenal(kolom, v);
}

export const peran = (v: unknown) => dalam("users.role", ROLES, v === "supervisor" ? "pemantau" : v);
export const statusInspeksi = (v: unknown) =>
  dalam("inspections.status", ["draf", "final"] as const, v === "draft" ? "draf" : v === "terkirim" ? "final" : v);
export const statusGerbang = (v: unknown) => dalam("inspections.gate_status", GATE_STATUSES, v === "lolos" ? "sesuai" : v);
export const kesimpulan = (v: unknown) => (v == null || v === "" ? null : dalam("inspections.kesimpulan", KESIMPULAN, v));
export const tingkat = (kolom: string, v: unknown) => dalam(kolom, SEVERITIES, v);
export const statusTemuan = (v: unknown) => dalam("issues.status", ISSUE_STATUSES, v);
export const statusJadwal = (v: unknown) => dalam("schedules.status", SCHEDULE_STATUSES, v);
export const tipeJawaban = (v: unknown) => dalam("checklist_items.answer_type", ANSWER_TYPES, v);
export const tipeLokasi = (v: unknown) => dalam("assets.lokasi_tipe", LOKASI_TIPE, v ?? "dalam_gedung");

/** Hash bcrypt Laravel ($2y$) diterima bcryptjs apa adanya; selain itu dianggap teks biasa (akun demo). */
export const sudahBcrypt = (v: string) => /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(v);

export const AKUN_DEMO = ["admin", "pemantau", "inspektur"];

/** Ukuran gambar dari header JPEG/PNG/WebP (tanpa sharp). null bila tak terbaca. */
export function ukuranGambar(b: Uint8Array): { width: number; height: number; contentType: string } | null {
  const buf = Buffer.from(b.buffer, b.byteOffset, b.byteLength);
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), contentType: "image/png" };
  }
  if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const jenis = buf.toString("ascii", 12, 16);
    if (jenis === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), contentType: "image/webp" };
    if (jenis === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, contentType: "image/webp" };
    if (jenis === "VP8L") {
      const n = buf.readUInt32LE(21);
      return { width: (n & 0x3fff) + 1, height: ((n >> 14) & 0x3fff) + 1, contentType: "image/webp" };
    }
    return null;
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const penanda = buf[i + 1]!;
      // SOF0..SOF15 kecuali DHT (C4), JPG (C8), DAC (CC).
      if (penanda >= 0xc0 && penanda <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(penanda)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7), contentType: "image/jpeg" };
      }
      if (penanda === 0xd8 || penanda === 0x01 || (penanda >= 0xd0 && penanda <= 0xd7)) {
        i += 2;
        continue;
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}
