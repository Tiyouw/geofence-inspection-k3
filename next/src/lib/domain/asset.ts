/**
 * Aturan domain aset yang murni (tanpa basis data), dipakai seed, server, dan klien.
 * Diterjemahkan dari app/Models/Asset.php.
 */
import {
  AKURASI_LEMAH_M,
  RADIUS_BAWAAN_M,
  RADIUS_PER_LOKASI,
  type GateStatus,
  type LokasiTipe,
} from "./constants";

/** Token acak, bukan nomor aset: nomor aset bisa terbaca orang, token tidak bisa ditebak. */
export function buatTokenQr(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "PAL-K3-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Jenis lokasi diturunkan dari nama gedung bila datanya belum punya kolom sendiri. */
export function tebakLokasiTipe(gedung: string): LokasiTipe {
  const g = gedung.toLowerCase();
  if (["workshop", "gudang", "bengkel"].some((k) => g.includes(k))) return "bengkel";
  if (["terbuka", "halaman", "parkir"].some((k) => g.includes(k))) return "area_terbuka";
  return "dalam_gedung";
}

/** radius = override aset ?? override lokasi ?? radius jenis lokasi. null = gerbang GPS tidak berlaku. */
export function radiusEfektif(opts: {
  radiusAset?: number | null;
  radiusLokasi?: number | null;
  lokasiTipe?: LokasiTipe | null;
}): number | null {
  if (opts.radiusAset) return opts.radiusAset;
  if (opts.radiusLokasi) return opts.radiusLokasi;
  const tipe = opts.lokasiTipe ?? "dalam_gedung";
  return tipe in RADIUS_PER_LOKASI ? RADIUS_PER_LOKASI[tipe] : RADIUS_BAWAAN_M;
}

/** Jarak haversine dalam meter, dibulatkan. null bila salah satu titik tak berkoordinat. */
export function jarakMeter(
  a: { lat: number | null | undefined; lng: number | null | undefined },
  b: { lat: number | null | undefined; lng: number | null | undefined },
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

/**
 * Bagian 5.6: evaluasi gerbang GPS. Pengiriman SELALU diterima; status hanya
 * menentukan penandaan dan antrean tinjauan admin.
 */
export function evaluasiGerbang(input: {
  radius: number | null;
  jarak: number | null;
  akurasi: number | null;
}): GateStatus {
  if (input.radius === null) return "tidak_berlaku";
  if (input.jarak === null) return "tanpa_gps";
  if (input.akurasi !== null && input.akurasi > AKURASI_LEMAH_M) return "gps_lemah";
  // Akurasi adalah jari-jari ketidakpastian, jadi ditambahkan ke ambang.
  const toleransi = input.radius + (input.akurasi ?? 0);
  if (input.jarak <= toleransi) return "sesuai";
  if (input.jarak <= toleransi * 2) return "perlu_review";
  return "jauh";
}

/** "Lt. 1" apa adanya; "1" jadi "Lt. 1"; "-" atau kosong jadi null. */
export function labelLantai(lantai: string | null | undefined): string | null {
  const l = (lantai ?? "").trim();
  if (l === "" || ["-", "–", "—"].includes(l)) return null;
  if (/^(lt\.?|lantai)\s/i.test(l)) return l;
  return `Lt. ${l}`;
}
