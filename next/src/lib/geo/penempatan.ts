/**
 * Penempatan titik aset di denah yang disetujui (keputusan pemilik 19 Nov 2026): semua aset aktif
 * ditaruh di dalam kawasan galangan, dengan aturan per modul.
 *
 * - APAR dan hydrant box: di dalam poligon gedung, menempel dinding (±1,2 m dari tepi), menyebar,
 *   tidak bertumpuk; sisi dinding mengikuti teks lokasi ("Lorong Timur" → dinding timur, "Bay 3" →
 *   urutan sepanjang gedung).
 * - Kotak P3K: bengkel serta gedung kantor/klinik.
 * - Hydrant pilar: di luar poligon gedung, di dalam kawasan, 6-14 m dari dinding bengkel.
 * - Mobil pemadam: tempat terbuka dekat gedung pos pemadam (SAT PK) bila ada; tanpa area (bergerak).
 * - Area terbatas tidak pernah dipakai kecuali aset memang sudah di area terbatas.
 *
 * Murni dan deterministik (tanpa basis data, tanpa acak): dipakai skrip penempatan dev dan seed demo,
 * dan diuji dengan poligon karangan.
 */
import type { AssetTypeSlug } from "../domain/constants";
import {
  type GeometriArea,
  type LngLat,
  type Titik,
  daftarPoligon,
  jarakKeTepiM,
  luasM2,
  titikDalamPoligon,
  titikTengah,
} from "./geometri";

export type Bangunan = { id: number; nama: string; polygon: GeometriArea; restricted: boolean };

export type AsetTempat = {
  id: number;
  kode: string;
  slug: AssetTypeSlug;
  /** Nama gedung/area lama (pengelompokan), mis. "Gedung PIP". */
  kelompok: string | null;
  lokasiTeks: string;
  lantai: string | null;
  /** Area saat ini bila poligonnya sudah disetujui DAN di dalam kawasan: aset tetap di area itu. */
  areaTetap: Bangunan | null;
  /** Aset sudah berada di area terbatas (boleh ditaruh di area terbatas lagi). */
  terbatas: boolean;
};

export type Tempat = { lat: number; lng: number; areaId: number | null; namaArea: string | null };

/* ---------- proyeksi lokal (meter) ---------- */

const M_DERAJAT = 111_320;
type XY = [number, number];

function proyeksi(asal: Titik) {
  const kx = M_DERAJAT * Math.cos((asal.lat * Math.PI) / 180);
  return {
    ke: ([lng, lat]: LngLat): XY => [(lng - asal.lng) * kx, (lat - asal.lat) * M_DERAJAT],
    dari: ([x, y]: XY): Titik => ({
      lng: Number((asal.lng + x / kx).toFixed(7)),
      lat: Number((asal.lat + y / M_DERAJAT).toFixed(7)),
    }),
  };
}

const jarak = (a: Titik, b: Titik) => {
  const kx = M_DERAJAT * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot((a.lng - b.lng) * kx, (a.lat - b.lat) * M_DERAJAT);
};

/* ---------- kandidat titik ---------- */

export type Sisi = "timur" | "barat" | "utara" | "selatan" | "tengah";

/** Sisi dari teks lokasi: "Lorong Timur titik 2" → timur. */
export function sisiDari(teks: string): Sisi | null {
  const t = teks.toLowerCase();
  if (/\btimur\b/.test(t)) return "timur";
  if (/\bbarat\b/.test(t)) return "barat";
  if (/\butara\b/.test(t)) return "utara";
  if (/\bselatan\b/.test(t)) return "selatan";
  if (/\btengah\b/.test(t)) return "tengah";
  return null;
}

/** Nomor urut dari teks lokasi ("titik 5", "Bay 3", "Pos 2"); null bila tidak ada. */
export function nomorDari(teks: string): number | null {
  const m = teks.match(/\b(?:titik|bay|pos)\s*(\d+)/i);
  return m ? Number(m[1]) : null;
}

type Kandidat = { t: Titik; s: number; arah: Sisi };

/** Titik sepanjang dinding di sisi DALAM poligon, berurutan menurut keliling. */
function kandidatDinding(g: GeometriArea, jarakDindingM = 1.2, langkahM = 1): Kandidat[] {
  const luar = daftarPoligon(g)[0]?.[0];
  if (!luar || luar.length < 4) return [];
  const pusat = titikTengah(g)!;
  const p = proyeksi(pusat);
  const xy = luar.map(p.ke);
  const hasil: Kandidat[] = [];
  let s = 0;
  for (let i = 1; i < xy.length; i++) {
    const [ax, ay] = xy[i - 1]!;
    const [bx, by] = xy[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.01) continue;
    const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
    for (let d = langkahM / 2; d < len; d += langkahM) {
      const [qx, qy] = [ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len];
      // Normal ke dalam: coba dua arah, ambil yang jatuh di dalam poligon.
      for (const k of [1, -1]) {
        const t = p.dari([qx + k * nx * jarakDindingM, qy + k * ny * jarakDindingM]);
        if (titikDalamPoligon(t, g) && jarakKeTepiM(t, g) >= jarakDindingM * 0.8) {
          // Arah hadap dinding (normal ke luar): -k * n.
          const [ox, oy] = [-k * nx, -k * ny];
          const arah: Sisi = Math.abs(ox) >= Math.abs(oy) ? (ox > 0 ? "timur" : "barat") : oy > 0 ? "utara" : "selatan";
          hasil.push({ t, s: s + d, arah });
          break;
        }
      }
    }
    s += len;
  }
  return hasil;
}

/** Ambil `n` titik merata dari daftar berurutan, menghindari titik terpakai (< `jarakMin` m). */
function ambilMerata(daftar: Titik[], n: number, terpakai: Titik[], jarakMin: number, hindari: Titik[] = []): Titik[] {
  const aman = daftar.filter((t) => hindari.every((u) => jarak(t, u) >= 3));
  const bebas = aman.filter((t) => terpakai.every((u) => jarak(t, u) >= jarakMin));
  // Kurang kandidat bebas: ambil yang paling jauh dari titik terpakai, tetap urut keliling.
  const terjauh = (xs: Titik[]) => {
    const skor = (t: Titik) => Math.min(Infinity, ...terpakai.map((u) => jarak(t, u)));
    const ambang = [...xs].map(skor).sort((a, b) => b - a)[Math.min(xs.length, n * 3) - 1] ?? 0;
    return xs.filter((t) => skor(t) >= ambang);
  };
  const sumber = bebas.length >= n ? bebas : terjauh(aman.length >= n ? aman : daftar);
  const hasil: Titik[] = [];
  for (let i = 0; i < n && sumber.length; i++) {
    const idx = Math.min(sumber.length - 1, Math.floor(((i + 0.5) * sumber.length) / n));
    let t = sumber[idx]!;
    // Bila bertabrakan dengan yang baru dipilih, geser ke kandidat bebas terdekat di urutan.
    for (let geser = 1; hasil.some((h) => jarak(h, t) < jarakMin) && geser < sumber.length; geser++) {
      t = sumber[(idx + geser) % sumber.length]!;
    }
    hasil.push(t);
  }
  return hasil;
}

/**
 * `n` titik menempel dinding di dalam gedung. `sisi` membatasi ke dinding sisi itu; "tengah" =
 * dinding utara/selatan bagian tengah. Tanpa sisi: merata keliling.
 */
export function titikDinding(
  g: GeometriArea,
  n: number,
  sisi: Sisi | null,
  terpakai: Titik[] = [],
  jarakMin = 3,
): Titik[] {
  if (n <= 0) return [];
  const semua = kandidatDinding(g);
  let pilih = semua;
  if (sisi === "tengah") {
    const lngs = semua.map((k) => k.t.lng);
    const [w, e] = [Math.min(...lngs), Math.max(...lngs)];
    pilih = semua.filter(
      (k) => (k.arah === "utara" || k.arah === "selatan") && Math.abs(k.t.lng - (w + e) / 2) <= (e - w) * 0.25,
    );
  } else if (sisi) pilih = semua.filter((k) => k.arah === sisi);
  if (pilih.length < n) pilih = semua;
  return ambilMerata(
    pilih.map((k) => k.t),
    n,
    terpakai,
    jarakMin,
  );
}

/**
 * `n` titik terbuka di luar gedung `g`, dalam kawasan, `dekat` m dari dindingnya, dan sedikitnya
 * 4 m dari gedung lain. `jarakMin` = jarak antartitik.
 */
export function titikLuar(
  g: GeometriArea,
  n: number,
  m: {
    kawasan: GeometriArea;
    gedungLain: GeometriArea[];
    /** Titik luar yang sudah dipakai: dijaga `jarakMin`. */
    terpakai?: Titik[];
    /** Titik lain (mis. di dalam gedung): cukup tidak bertumpuk (≥ 3 m). */
    hindari?: Titik[];
    jarakMin?: number;
    dekat?: [number, number];
  },
): Titik[] {
  if (n <= 0) return [];
  const [dMin, dMax] = m.dekat ?? [6, 14];
  const pusat = titikTengah(g)!;
  const lain = m.gedungLain.filter((x) => {
    const t = titikTengah(x);
    return t && jarak(t, pusat) < Math.sqrt(luasM2(g)) + 200;
  });
  const kandidat: Titik[] = [];
  for (const d of [dMin, (dMin + dMax) / 2, dMax]) {
    for (const k of kandidatDindingLuar(g, d)) {
      if (!titikDalamPoligon(k, m.kawasan) || jarakKeTepiM(k, m.kawasan) < 3) continue;
      if (lain.some((x) => titikDalamPoligon(k, x) || jarakKeTepiM(k, x) < 4)) continue;
      kandidat.push(k);
    }
    if (kandidat.length >= n * 4) break;
  }
  return ambilMerata(kandidat, n, m.terpakai ?? [], m.jarakMin ?? 8, m.hindari ?? []);
}

function kandidatDindingLuar(g: GeometriArea, jarakM: number, langkahM = 2): Titik[] {
  const luar = daftarPoligon(g)[0]?.[0];
  if (!luar) return [];
  const p = proyeksi(titikTengah(g)!);
  const xy = luar.map(p.ke);
  const hasil: Titik[] = [];
  for (let i = 1; i < xy.length; i++) {
    const [ax, ay] = xy[i - 1]!;
    const [bx, by] = xy[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.01) continue;
    const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
    for (let d = langkahM / 2; d < len; d += langkahM) {
      const [qx, qy] = [ax + ((bx - ax) * d) / len, ay + ((by - ay) * d) / len];
      for (const k of [1, -1]) {
        const t = p.dari([qx + k * nx * jarakM, qy + k * ny * jarakM]);
        if (!titikDalamPoligon(t, g) && jarakKeTepiM(t, g) >= jarakM * 0.8) {
          hasil.push(t);
          break;
        }
      }
    }
  }
  return hasil;
}

/* ---------- rencana ---------- */

const BENGKEL = /^beng/i;
/** Gedung kantor/klinik/pos untuk kotak P3K, urut prioritas. */
const KANTOR = [/kesind|klinik|kesehatan|medis/i, /kantor|desain|div\./i, /serba guna/i, /^sat\s*pk$/i];
const POS_PEMADAM = /^sat\s*pk$|pemadam|damkar/i;

export type Denah = { kawasan: GeometriArea; bangunan: Bangunan[] };

/** Bangunan yang boleh dipakai: disetujui, di dalam kawasan. */
export function bangunanDalam(d: Denah): Bangunan[] {
  return d.bangunan.filter((b) => {
    const t = titikTengah(b.polygon);
    return t && titikDalamPoligon(t, d.kawasan);
  });
}

function urutKode(a: AsetTempat, b: AsetTempat) {
  return (
    (nomorDari(a.lokasiTeks) ?? 999) - (nomorDari(b.lokasiTeks) ?? 999) ||
    a.kode.localeCompare(b.kode, "id", { numeric: true })
  );
}

/**
 * Rencana penempatan: id aset → titik dan area. Aset dengan `areaTetap` tetap di area itu.
 * Kelompok lama (mis. "Gedung PIP" per lantai, "Workshop Fabrikasi") dipetakan utuh ke satu bengkel
 * supaya urutan lorong/bay tetap masuk akal; bengkel dipilih yang bebannya paling ringan.
 */
export function rencanaPenempatan(aset: AsetTempat[], denah: Denah): Map<number, Tempat> {
  const semua = bangunanDalam(denah);
  const urutLuas = (a: Bangunan, b: Bangunan) => luasM2(b.polygon) - luasM2(a.polygon) || a.id - b.id;
  const bengkelBernama = semua.filter((b) => BENGKEL.test(b.nama) && !b.restricted).sort(urutLuas);
  // Denah tanpa bengkel bernama BENG…: pakai gedung tidak terbatas terluas (paling banyak 5).
  const bengkel = bengkelBernama.length
    ? bengkelBernama
    : semua
        .filter((b) => !b.restricted)
        .sort(urutLuas)
        .slice(0, 5);
  if (!bengkel.length) throw new Error("Tidak ada gedung disetujui yang tidak terbatas di dalam kawasan.");
  const terbatas = semua.filter((b) => b.restricted).sort((a, b) => a.id - b.id);
  const kantor = KANTOR.map(
    (p) => semua.filter((b) => p.test(b.nama) && !b.restricted).sort((a, b) => a.id - b.id)[0],
  ).filter((b): b is Bangunan => !!b);
  const pos =
    semua
      .filter((b) => POS_PEMADAM.test(b.nama))
      .sort((a, b) => luasM2(b.polygon) - luasM2(a.polygon) || a.id - b.id)[0] ?? bengkel[0]!;

  const hasil = new Map<number, Tempat>();
  const terpakai: Titik[] = [];
  const terpakaiLuar: Titik[] = [];
  const beban = new Map<number, number>(bengkel.map((b) => [b.id, 0]));
  const taruh = (a: AsetTempat, b: Bangunan | null, t: Titik) => {
    hasil.set(a.id, { lat: t.lat, lng: t.lng, areaId: b?.id ?? null, namaArea: b?.nama ?? null });
    terpakai.push(t);
    if (b && beban.has(b.id)) beban.set(b.id, beban.get(b.id)! + 1);
  };
  const teringan = () =>
    [...bengkel].sort((a, b) => beban.get(a.id)! - beban.get(b.id)! || luasM2(b.polygon) - luasM2(a.polygon))[0]!;
  const dinding = (b: Bangunan, daftar: AsetTempat[]) => {
    // Per sisi supaya "Lorong Timur" di dinding timur, dst.; urut nomor titik/bay.
    const perSisi = Map.groupBy(daftar, (a) => sisiDari(a.lokasiTeks));
    for (const [sisi, isi] of perSisi) {
      isi.sort(urutKode);
      titikDinding(b.polygon, isi.length, sisi, terpakai).forEach((t, i) => taruh(isi[i]!, b, t));
    }
  };

  // 1. Aset yang areanya sudah sah (disetujui, di kawasan): tetap di area itu, titik di dinding.
  const tetap = aset.filter((a) => a.areaTetap && a.slug !== "mobil_pemadam");
  for (const [, isi] of Map.groupBy(tetap, (a) => a.areaTetap!.id)) dinding(isi[0]!.areaTetap!, isi);
  const sisa = aset.filter((a) => !hasil.has(a.id) && !(a.areaTetap && a.slug !== "mobil_pemadam"));

  // 2. Aset di area terbatas yang memang sudah terbatas.
  const keTerbatas = terbatas.length
    ? sisa.filter((a) => a.terbatas && a.slug !== "mobil_pemadam" && a.slug !== "hydrant_pilar")
    : [];
  if (keTerbatas.length) dinding(terbatas[0]!, keTerbatas);

  // 3. APAR, hydrant box, dan P3K kelompok bengkel/gedung: per kelompok (kelompok + lantai) ke satu bengkel.
  const dalamGedung = sisa.filter(
    (a) => !hasil.has(a.id) && (a.slug === "apar" || a.slug === "hydrant_box" || a.slug === "p3k"),
  );
  const keKantor = dalamGedung.filter(
    (a) => a.slug === "p3k" && kantor.length && /klinik|kantor|pos\b|jaga/i.test(`${a.kelompok} ${a.lokasiTeks}`),
  );
  const keBengkel = dalamGedung.filter((a) => !keKantor.includes(a));
  const kelompok = Map.groupBy(keBengkel, (a) => `${a.kelompok ?? "-"}|${a.lantai ?? "-"}`);
  for (const [, isi] of [...kelompok.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])))
    dinding(teringan(), isi);
  keKantor.sort(urutKode).forEach((a, i) => {
    const prefer = /klinik/i.test(`${a.kelompok} ${a.lokasiTeks}`) ? kantor[0]! : kantor[i % kantor.length]!;
    dinding(prefer, [a]);
  });

  // 4. Hydrant pilar: luar gedung, dekat bengkel bergiliran; area = bengkel terdekat itu.
  const gedungLain = semua.map((b) => b.polygon);
  const pilar = sisa.filter((a) => a.slug === "hydrant_pilar").sort(urutKode);
  pilar.forEach((a, i) => {
    const b = bengkel[i % bengkel.length]!;
    const [t] = titikLuar(b.polygon, 1, {
      kawasan: denah.kawasan,
      gedungLain: gedungLain.filter((g) => g !== b.polygon),
      terpakai: terpakaiLuar,
      hindari: terpakai,
      jarakMin: 25,
    });
    if (t) {
      taruh(a, b, t);
      terpakaiLuar.push(t);
    }
  });

  // 5. Mobil pemadam: tempat terbuka dekat pos pemadam, tanpa area.
  const mobil = sisa.filter((a) => a.slug === "mobil_pemadam").sort(urutKode);
  const parkir = titikLuar(pos.polygon, mobil.length, {
    kawasan: denah.kawasan,
    gedungLain: gedungLain.filter((g) => g !== pos.polygon),
    terpakai: terpakaiLuar,
    hindari: terpakai,
    jarakMin: 8,
    dekat: [8, 20],
  });
  mobil.forEach((a, i) => parkir[i] && taruh(a, null, parkir[i]!));

  return hasil;
}
