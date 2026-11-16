/**
 * SPEC §7.4: kompresi foto di perangkat sebelum disimpan. Orientasi EXIF dari
 * createImageBitmap, lebar maks 1600 px (tidak diperbesar), JPEG mutu 0,82.
 */
import { sha256HexBlob } from "./ids";

export const LEBAR_MAKS = 1600;
export const MUTU_JPEG = 0.82;

export type FotoTerkompres = { blob: Blob; width: number; height: number; sha256: string };

export function ukuranTarget(w: number, h: number, maks = LEBAR_MAKS): { width: number; height: number } {
  if (w <= maks) return { width: w, height: h };
  return { width: maks, height: Math.round((h * maks) / w) };
}

export async function kompresFoto(file: Blob): Promise<FotoTerkompres> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Format foto tidak didukung (${file.type || "tidak dikenal"}). Gunakan kamera bawaan, bukan berkas HEIC.`);
  }
  const { width, height } = ukuranTarget(bmp.width, bmp.height);
  let blob: Blob;
  if (typeof OffscreenCanvas !== "undefined") {
    const c = new OffscreenCanvas(width, height);
    c.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
    blob = await c.convertToBlob({ type: "image/jpeg", quality: MUTU_JPEG });
  } else {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    c.getContext("2d")!.drawImage(bmp, 0, 0, width, height);
    blob = await new Promise<Blob>((ok, gagal) =>
      c.toBlob((b) => (b ? ok(b) : gagal(new Error("Gagal memproses foto."))), "image/jpeg", MUTU_JPEG),
    );
  }
  bmp.close();
  return { blob, width, height, sha256: await sha256HexBlob(blob) };
}
