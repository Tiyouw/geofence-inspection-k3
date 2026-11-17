/**
 * Geometri murni untuk gerbang lokasi (ADR-1, ADR-7). Tanpa basis data, tanpa I/O:
 * dipakai klien (pratinjau sebelum kirim) dan peladen (keputusan resmi).
 *
 * Koordinat mengikuti GeoJSON: [lng, lat] dalam derajat WGS84.
 * Jarak dihitung pada proyeksi equirektangular lokal yang berpusat di titik uji.
 * Untuk kawasan galangan (beberapa km) galatnya jauh di bawah 1 m, jauh lebih kecil
 * dari galat GPS dan galat georeferensi denah (±8 m).
 */

export type LngLat = [number, number];
/** Cincin tertutup: titik pertama sama dengan titik terakhir. */
export type Cincin = LngLat[];

export type PoligonGeo = { type: "Polygon"; coordinates: Cincin[] };
export type MultiPoligonGeo = { type: "MultiPolygon"; coordinates: Cincin[][] };
export type GeometriArea = PoligonGeo | MultiPoligonGeo;

export type Titik = { lat: number; lng: number };

const R_BUMI_M = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Batas jumlah titik per poligon (PRD, Empty/error/limit states). */
export const MAKS_TITIK_POLIGON = 200;

/** Daftar poligon (masing-masing: cincin luar + lubang) dari Polygon atau MultiPolygon. */
export function daftarPoligon(g: GeometriArea): Cincin[][] {
  return g.type === "Polygon" ? [g.coordinates] : g.coordinates;
}

/** Ray casting pada satu cincin. Titik tepat di garis dianggap di dalam. */
function dalamCincin(p: Titik, cincin: Cincin): boolean {
  let dalam = false;
  const n = cincin.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = cincin[i];
    const [xj, yj] = cincin[j];
    if (diSegmen(p, cincin[j], cincin[i])) return true;
    const memotong = yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;
    if (memotong) dalam = !dalam;
  }
  return dalam;
}

function diSegmen(p: Titik, a: LngLat, b: LngLat): boolean {
  const eps = 1e-12;
  const cross = (b[0] - a[0]) * (p.lat - a[1]) - (b[1] - a[1]) * (p.lng - a[0]);
  if (Math.abs(cross) > eps) return false;
  return (
    p.lng >= Math.min(a[0], b[0]) - eps &&
    p.lng <= Math.max(a[0], b[0]) + eps &&
    p.lat >= Math.min(a[1], b[1]) - eps &&
    p.lat <= Math.max(a[1], b[1]) + eps
  );
}

/** Titik di dalam poligon (lubang dihormati). */
export function titikDalamPoligon(p: Titik, g: GeometriArea): boolean {
  return daftarPoligon(g).some(([luar, ...lubang]) => {
    if (!luar || !dalamCincin(p, luar)) return false;
    // Titik tepat di tepi lubang masih dihitung di dalam area.
    return !lubang.some((h) => dalamCincin(p, h) && !diTepiCincin(p, h));
  });
}

function diTepiCincin(p: Titik, cincin: Cincin): boolean {
  for (let i = 1; i < cincin.length; i++) if (diSegmen(p, cincin[i - 1], cincin[i])) return true;
  return false;
}

/** Proyeksi equirektangular lokal (meter) dengan pusat `o`. */
function proyektor(o: Titik) {
  const kx = rad(1) * R_BUMI_M * Math.cos(rad(o.lat));
  const ky = rad(1) * R_BUMI_M;
  return ([lng, lat]: LngLat): [number, number] => [(lng - o.lng) * kx, (lat - o.lat) * ky];
}

/** Jarak (m) dari titik asal (0,0) ke segmen a-b pada bidang proyeksi. */
function jarakAsalKeSegmen(a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / len2));
  return Math.hypot(a[0] + t * dx, a[1] + t * dy);
}

/** Jarak terpendek (m) dari titik ke tepi poligon, tak peduli di dalam atau di luar. */
export function jarakKeTepiM(p: Titik, g: GeometriArea): number {
  const proj = proyektor(p);
  let min = Infinity;
  for (const poligon of daftarPoligon(g)) {
    for (const cincin of poligon) {
      for (let i = 1; i < cincin.length; i++) {
        const d = jarakAsalKeSegmen(proj(cincin[i - 1]), proj(cincin[i]));
        if (d < min) min = d;
      }
    }
  }
  return min;
}

/** Jarak (m) dari titik ke area: 0 bila di dalam, selain itu jarak ke tepi terdekat. */
export function jarakKeAreaM(p: Titik, g: GeometriArea): number {
  return titikDalamPoligon(p, g) ? 0 : jarakKeTepiM(p, g);
}

/** Luas (m²) cincin luar dikurangi lubang, untuk memilih area terkecil yang memuat titik. */
export function luasM2(g: GeometriArea): number {
  let total = 0;
  for (const [luar, ...lubang] of daftarPoligon(g)) {
    if (!luar?.length) continue;
    const proj = proyektor({ lng: luar[0][0], lat: luar[0][1] });
    const luasCincin = (c: Cincin) => {
      let s = 0;
      for (let i = 1; i < c.length; i++) {
        const [x1, y1] = proj(c[i - 1]);
        const [x2, y2] = proj(c[i]);
        s += x1 * y2 - x2 * y1;
      }
      return Math.abs(s) / 2;
    };
    total += luasCincin(luar) - lubang.reduce((a, h) => a + luasCincin(h), 0);
  }
  return total;
}

/** Titik tengah sederhana (rata-rata simpul cincin luar pertama), untuk label dan zoom. */
export function titikTengah(g: GeometriArea): Titik | null {
  const luar = daftarPoligon(g)[0]?.[0];
  if (!luar || luar.length < 2) return null;
  const simpul = luar.slice(0, -1);
  const lng = simpul.reduce((a, c) => a + c[0], 0) / simpul.length;
  const lat = simpul.reduce((a, c) => a + c[1], 0) / simpul.length;
  return { lat, lng };
}

/* ---------- validasi ---------- */

export type HasilValidasi = { sah: true } | { sah: false; pesan: string };

function segmenBerpotongan(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  const o = (p: LngLat, q: LngLat, r: LngLat) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const o1 = o(a, b, c);
  const o2 = o(a, b, d);
  const o3 = o(c, d, a);
  const o4 = o(c, d, b);
  if (o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0) return true;
  const kolinearTumpang = (p: LngLat, q: LngLat, r: LngLat) =>
    r[0] <= Math.max(p[0], q[0]) && r[0] >= Math.min(p[0], q[0]) && r[1] <= Math.max(p[1], q[1]) && r[1] >= Math.min(p[1], q[1]);
  if (o1 === 0 && kolinearTumpang(a, b, c)) return true;
  if (o2 === 0 && kolinearTumpang(a, b, d)) return true;
  if (o3 === 0 && kolinearTumpang(c, d, a)) return true;
  if (o4 === 0 && kolinearTumpang(c, d, b)) return true;
  return false;
}

/** Cincin memotong dirinya sendiri (segmen yang tidak bertetangga saling memotong). */
export function cincinBersilangan(c: Cincin): boolean {
  const n = c.length - 1; // jumlah segmen
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmenBerpotongan(c[i], c[i + 1], c[j], c[j + 1])) return true;
    }
  }
  return false;
}

/** Menutup cincin bila titik terakhir belum sama dengan titik pertama. */
export function tutupCincin(c: LngLat[]): Cincin {
  if (c.length === 0) return c;
  const [a, z] = [c[0], c[c.length - 1]];
  return a[0] === z[0] && a[1] === z[1] ? c : [...c, [a[0], a[1]]];
}

function koordinatSah(p: unknown): p is LngLat {
  return (
    Array.isArray(p) &&
    p.length >= 2 &&
    typeof p[0] === "number" &&
    typeof p[1] === "number" &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    Math.abs(p[0]) <= 180 &&
    Math.abs(p[1]) <= 90
  );
}

/** Memeriksa geometri area: bentuk GeoJSON, rentang WGS84, jumlah titik, dan garis bersilangan. */
export function validasiGeometri(g: unknown): HasilValidasi {
  if (!g || typeof g !== "object") return { sah: false, pesan: "Geometri kosong." };
  const geo = g as { type?: unknown; coordinates?: unknown };
  if (geo.type !== "Polygon" && geo.type !== "MultiPolygon") {
    return { sah: false, pesan: "Hanya Polygon atau MultiPolygon yang diterima." };
  }
  const poligon = (geo.type === "Polygon" ? [geo.coordinates] : geo.coordinates) as unknown;
  if (!Array.isArray(poligon) || poligon.length === 0) return { sah: false, pesan: "Poligon tidak berisi titik." };
  for (const cincinList of poligon) {
    if (!Array.isArray(cincinList) || cincinList.length === 0) return { sah: false, pesan: "Poligon tidak berisi titik." };
    for (const cincin of cincinList) {
      if (!Array.isArray(cincin) || !cincin.every(koordinatSah)) {
        return { sah: false, pesan: "Koordinat tidak sah. Gunakan GeoJSON WGS84 [bujur, lintang]." };
      }
      const c = tutupCincin(cincin.map((p) => [p[0], p[1]] as LngLat));
      if (c.length < 4) return { sah: false, pesan: "Poligon perlu sedikitnya tiga titik." };
      if (c.length - 1 > MAKS_TITIK_POLIGON) {
        return { sah: false, pesan: `Poligon terlalu rinci: lebih dari ${MAKS_TITIK_POLIGON} titik.` };
      }
      if (cincinBersilangan(c)) return { sah: false, pesan: "Poligon tidak sah: garis saling memotong." };
    }
  }
  return { sah: true };
}

/** Menormalkan geometri: setiap cincin ditutup, koordinat dibulatkan 7 desimal (~1 cm). */
export function normalkanGeometri(g: GeometriArea): GeometriArea {
  const bulat = (n: number) => Math.round(n * 1e7) / 1e7;
  const cincin = (c: Cincin): Cincin => tutupCincin(c.map((p) => [bulat(p[0]), bulat(p[1])] as LngLat));
  return g.type === "Polygon"
    ? { type: "Polygon", coordinates: g.coordinates.map(cincin) }
    : { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map(cincin)) };
}
