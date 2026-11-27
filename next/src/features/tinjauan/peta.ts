/**
 * Batas tampilan peta tinjauan (bug 19 Nov 2026: peta terbuka jauh di sekitar posisi inspektur
 * tanpa memperlihatkan area aset). Fokus: poligon gedung aset (atau titik aset bila belum ada
 * poligon), posisi inspektur beserta lingkaran akurasinya. Kawasan ikut dibingkai bila dekat
 * (≤ 5 km) supaya galangan tidak menarik peta menjauh dari bukti yang ditinjau.
 */
import { type GeometriArea, daftarPoligon } from "@/lib/geo/geometri";

export type Batas = [[number, number], [number, number]];
type Kotak = { s: number; w: number; n: number; e: number };

const M_PER_DERAJAT = 111_320;
const KAWASAN_DEKAT_M = 5_000;
/** Bentang minimum (m) supaya satu titik tidak membuka zoom maksimum. */
const BENTANG_MIN_M = 60;

function kotakPoligon(g: GeometriArea): Kotak {
  const k = { s: Infinity, w: Infinity, n: -Infinity, e: -Infinity };
  for (const [luar] of daftarPoligon(g))
    for (const [lng, lat] of luar ?? []) {
      k.s = Math.min(k.s, lat);
      k.n = Math.max(k.n, lat);
      k.w = Math.min(k.w, lng);
      k.e = Math.max(k.e, lng);
    }
  return k;
}

function gabung(a: Kotak | null, b: Kotak): Kotak {
  return a ? { s: Math.min(a.s, b.s), w: Math.min(a.w, b.w), n: Math.max(a.n, b.n), e: Math.max(a.e, b.e) } : b;
}

function kotakTitik(lat: number, lng: number, radiusM: number): Kotak {
  const dLat = radiusM / M_PER_DERAJAT;
  const dLng = radiusM / (M_PER_DERAJAT * Math.cos((lat * Math.PI) / 180));
  return { s: lat - dLat, n: lat + dLat, w: lng - dLng, e: lng + dLng };
}

function jarakTengahM(a: Kotak, b: Kotak): number {
  const lat = ((a.s + a.n) / 2 + (b.s + b.n) / 2) / 2;
  const dy = ((a.s + a.n) / 2 - (b.s + b.n) / 2) * M_PER_DERAJAT;
  const dx = ((a.w + a.e) / 2 - (b.w + b.e) / 2) * M_PER_DERAJAT * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

export function batasTinjauan(m: {
  area: GeometriArea | null;
  kawasan: GeometriArea | null;
  aset: { lat: number; lng: number } | null;
  inspektur: { lat: number; lng: number; akurasi: number | null } | null;
}): Batas | null {
  let inti: Kotak | null = null;
  if (m.area) inti = gabung(inti, kotakPoligon(m.area));
  else if (m.aset) inti = gabung(inti, kotakTitik(m.aset.lat, m.aset.lng, BENTANG_MIN_M / 2));
  if (m.inspektur) inti = gabung(inti, kotakTitik(m.inspektur.lat, m.inspektur.lng, Math.max(m.inspektur.akurasi ?? 0, BENTANG_MIN_M / 2)));
  if (m.kawasan) {
    const k = kotakPoligon(m.kawasan);
    if (!inti || jarakTengahM(inti, k) <= KAWASAN_DEKAT_M) inti = gabung(inti, k);
  }
  return inti ? [[inti.s, inti.w], [inti.n, inti.e]] : null;
}
