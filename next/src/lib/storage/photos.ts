/**
 * Penyimpanan foto bukti inspeksi. PRIVAT: tidak ada URL publik (SPEC §3.6, §9 #2).
 *
 * - Produksi/preview: Vercel Blob dengan access "private" (BLOB_READ_WRITE_TOKEN dari
 *   store pal-k3-foto yang terhubung ke proyek).
 * - Lokal/CI tanpa token: berkas di next/.data/foto (di-.gitignore), supaya alur dan tes
 *   jalan tanpa akun Vercel.
 *
 * Foto hanya boleh ditampilkan lewat GET /api/foto/{id}, yang memeriksa sesi dan peran
 * (lihat bolehLihatFoto). Jangan pernah meneruskan URL blob ke klien.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { del, get, put } from "@vercel/blob";
import type { Role } from "@/lib/domain/constants";

const LOKAL = join(process.cwd(), ".data", "foto");

function pakaiBlob(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  if (process.env.VERCEL) throw new Error("BLOB_READ_WRITE_TOKEN belum diatur di Vercel.");
  return false;
}

/** inspeksi/{inspectionId}/{photoId}.jpg */
export function kunciFoto(inspectionId: string, photoId: string, ext = "jpg"): string {
  return `inspeksi/${inspectionId}/${photoId}.${ext}`;
}

export function sha256Hex(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function simpanFoto(key: string, data: Uint8Array, contentType: string): Promise<void> {
  if (pakaiBlob()) {
    await put(key, Buffer.from(data), {
      access: "private",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  const path = join(LOKAL, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

export async function bacaFoto(key: string): Promise<{ stream: ReadableStream<Uint8Array>; size: number | null } | null> {
  if (pakaiBlob()) {
    const res = await get(key, { access: "private" });
    if (!res || res.statusCode !== 200) return null;
    return { stream: res.stream, size: res.blob.size };
  }
  try {
    const buf = await readFile(join(LOKAL, key));
    return { stream: new Blob([buf]).stream(), size: buf.byteLength };
  } catch {
    return null;
  }
}

export async function hapusFoto(key: string): Promise<void> {
  if (pakaiBlob()) {
    await del(key);
    return;
  }
  await rm(join(LOKAL, key), { force: true });
}

/** Admin dan pemantau melihat semua foto (SPEC §9 #1); inspektur hanya foto inspeksinya sendiri. */
export function bolehLihatFoto(user: { id: number; role: Role }, pemilikInspeksiId: number): boolean {
  return user.role === "admin" || user.role === "pemantau" || user.id === pemilikInspeksiId;
}
