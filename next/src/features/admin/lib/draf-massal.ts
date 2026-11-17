/**
 * Pemilahan draf untuk "Setujui massal" (editor area). Dipakai di klien (angka di tombol dan
 * dialog) dan di peladen (pemeriksaan ulang), jadi keduanya selalu sepakat.
 */
import { type GeometriArea, titikDalamPoligon, titikTengah, validasiGeometri } from "@/lib/geo/geometri";

export type AreaDraf = { id: number; nama: string; jenis: string; polygon: GeometriArea | null; polygonDraf: GeometriArea | null };

export type PilahSetujui = {
  setujui: number[];
  /** Calon batas kawasan: disetujui lewat "Jadikan batas kawasan", bukan massal. */
  kawasan: number[];
  tidakSah: { id: number; pesan: string }[];
};

/** Poligon yang memuat titik tengah sedikitnya sekian area lain dianggap batas kawasan, bukan gedung. */
export const AMBANG_CALON_KAWASAN = 5;

function kotakBatas(g: GeometriArea) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of g.type === "Polygon" ? [g.coordinates] : g.coordinates)
    for (const [x, y] of p[0] ?? []) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  return { minX, minY, maxX, maxY };
}

/**
 * @param draf area yang hendak disetujui (harus punya polygonDraf)
 * @param semua semua area aktif, untuk mengenali calon kawasan
 */
export function pilahSetujuiMassal(draf: AreaDraf[], semua: AreaDraf[]): PilahSetujui {
  const hasil: PilahSetujui = { setujui: [], kawasan: [], tidakSah: [] };
  const tengah = semua
    .map((a) => {
      const g = a.polygon ?? a.polygonDraf;
      const t = g && validasiGeometri(g).sah ? titikTengah(g) : null;
      return t ? { id: a.id, t } : null;
    })
    .filter((x): x is { id: number; t: { lat: number; lng: number } } => !!x);
  for (const a of draf) {
    const v = validasiGeometri(a.polygonDraf);
    if (!a.polygonDraf || !v.sah) {
      hasil.tidakSah.push({ id: a.id, pesan: v.sah ? "Geometri kosong." : v.pesan });
      continue;
    }
    if (a.jenis === "kawasan" || /kawasan/i.test(a.nama)) {
      hasil.kawasan.push(a.id);
      continue;
    }
    const k = kotakBatas(a.polygonDraf);
    let dimuat = 0;
    for (const { id, t } of tengah) {
      if (id === a.id || t.lng < k.minX || t.lng > k.maxX || t.lat < k.minY || t.lat > k.maxY) continue;
      if (titikDalamPoligon(t, a.polygonDraf) && ++dimuat >= AMBANG_CALON_KAWASAN) break;
    }
    if (dimuat >= AMBANG_CALON_KAWASAN) hasil.kawasan.push(a.id);
    else hasil.setujui.push(a.id);
  }
  return hasil;
}

/** Kalimat alasan pelewatan, mis. "2 dilewati: 1 calon batas kawasan, 1 geometri tidak sah". */
export function kalimatDilewati(p: Pick<PilahSetujui, "kawasan" | "tidakSah">): string {
  const n = p.kawasan.length + p.tidakSah.length;
  if (!n) return "";
  const bagian = [
    p.kawasan.length ? `${p.kawasan.length} calon batas kawasan (setujui lewat "Jadikan batas kawasan")` : "",
    p.tidakSah.length ? `${p.tidakSah.length} geometri tidak sah (garis saling memotong atau kosong)` : "",
  ].filter(Boolean);
  return `${n} dilewati: ${bagian.join(", ")}.`;
}
