/**
 * Membaca GeoJSON hasil olahan denah (ADR-10): FeatureCollection berisi Polygon /
 * MultiPolygon WGS84 dengan properti label. Fungsi murni: dipakai pratinjau di peramban
 * dan validasi ulang di peladen.
 */
import { type GeometriArea, normalkanGeometri, validasiGeometri } from "./geometri";

/** Properti yang dibaca sebagai nama, berurutan. */
export const PROPERTI_LABEL = ["label", "nama", "name", "Name", "LABEL", "NAMA", "Text", "text"] as const;

/** Batas jumlah fitur per impor (hasil spike: 482 poligon). */
export const MAKS_FITUR_IMPOR = 1000;

export type FiturImpor = {
  /** Urutan fitur di berkas (mulai 1), untuk pesan galat. */
  urut: number;
  label: string | null;
  geometry: GeometriArea | null;
  /** Pesan bila fitur ini tidak dapat dipakai. */
  galat: string | null;
};

export type HasilImpor =
  | { ok: true; fitur: FiturImpor[]; sah: number; galat: number }
  | { ok: false; pesan: string };

function ambilLabel(props: unknown): string | null {
  if (!props || typeof props !== "object") return null;
  const p = props as Record<string, unknown>;
  for (const k of PROPERTI_LABEL) {
    const v = p[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 120);
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** `teks` atau objek hasil JSON.parse. */
export function bacaGeoJson(masukan: unknown): HasilImpor {
  let data = masukan;
  if (typeof masukan === "string") {
    try {
      data = JSON.parse(masukan);
    } catch {
      return { ok: false, pesan: "Berkas bukan JSON yang sah." };
    }
  }
  if (!data || typeof data !== "object") return { ok: false, pesan: "Berkas bukan GeoJSON." };
  const d = data as { type?: unknown; features?: unknown; crs?: { properties?: { name?: unknown } } };

  const crs = d.crs?.properties?.name;
  if (typeof crs === "string" && !/CRS84|4326/i.test(crs)) {
    return { ok: false, pesan: `Sistem koordinat ${crs} tidak didukung. Ekspor ulang sebagai WGS84 (EPSG:4326).` };
  }

  let mentah: unknown[];
  if (d.type === "FeatureCollection" && Array.isArray(d.features)) mentah = d.features;
  else if (d.type === "Feature") mentah = [d];
  else return { ok: false, pesan: "Berkas harus berupa FeatureCollection GeoJSON." };

  if (mentah.length === 0) return { ok: false, pesan: "Berkas tidak berisi poligon." };
  if (mentah.length > MAKS_FITUR_IMPOR) {
    return { ok: false, pesan: `Terlalu banyak fitur (${mentah.length}). Batasnya ${MAKS_FITUR_IMPOR} per impor.` };
  }

  const fitur: FiturImpor[] = mentah.map((f, i) => {
    const urut = i + 1;
    const ft = (f ?? {}) as { geometry?: unknown; properties?: unknown };
    const label = ambilLabel(ft.properties);
    const v = validasiGeometri(ft.geometry);
    if (!v.sah) return { urut, label, geometry: null, galat: v.pesan };
    return { urut, label, geometry: normalkanGeometri(ft.geometry as GeometriArea), galat: null };
  });

  const sah = fitur.filter((f) => f.galat === null).length;
  return { ok: true, fitur, sah, galat: fitur.length - sah };
}

/** Kode area dari label: "Bengkel Las 2" → "BENGKEL-LAS-2". */
export function kodeDariLabel(label: string, cadangan: string): string {
  const k = label
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .toUpperCase()
    .slice(0, 40);
  return k || cadangan;
}
