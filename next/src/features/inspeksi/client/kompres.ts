/**
 * Kompresi foto di perangkat sebelum disimpan (PRD "Aturan bukti" 3, Tech Spec): bingkai
 * kamera aplikasi digambar ke kanvas, sisi panjang ≤ 1600 px (tidak diperbesar), JPEG mutu 0,82.
 */
import { sha256HexBlob } from "./ids";

export const SISI_MAKS = 1600;
export const MUTU_JPEG = 0.82;

export type FotoTerkompres = { blob: Blob; width: number; height: number; sha256: string };

export function ukuranTarget(w: number, h: number, maks = SISI_MAKS): { width: number; height: number } {
  const panjang = Math.max(w, h);
  if (panjang <= maks) return { width: w, height: h };
  const skala = maks / panjang;
  return { width: Math.round(w * skala), height: Math.round(h * skala) };
}

/** Ambil satu bingkai dari `<video>` kamera dan kompres. */
export async function kompresBingkai(sumber: CanvasImageSource, w: number, h: number): Promise<FotoTerkompres> {
  if (!w || !h) throw new Error("Kamera belum siap. Tunggu sebentar lalu jepret lagi.");
  const { width, height } = ukuranTarget(w, h);
  let blob: Blob;
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(width, height);
    c.getContext("2d")!.drawImage(sumber, 0, 0, width, height);
    blob = await c.convertToBlob({ type: "image/jpeg", quality: MUTU_JPEG });
  } else {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    c.getContext("2d")!.drawImage(sumber, 0, 0, width, height);
    blob = await new Promise<Blob>((ok, gagal) =>
      c.toBlob((b) => (b ? ok(b) : gagal(new Error("Foto belum tersimpan. Ulangi langkah ini."))), "image/jpeg", MUTU_JPEG),
    );
  }
  return { blob, width, height, sha256: await sha256HexBlob(blob) };
}
