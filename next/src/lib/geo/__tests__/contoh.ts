/**
 * Geometri SINTETIS untuk uji. Bukan denah galangan: denah asli bersifat rahasia dan
 * tidak boleh masuk repo. Titik asal sengaja ditaruh di laut lepas.
 */
import type { GeometriArea, Titik } from "../geometri";

export const ASAL: Titik = { lat: -5.5, lng: 107.5 };

const M_PER_DERAJAT_LAT = 111_195;

/** Titik yang bergeser `timur` dan `utara` meter dari ASAL. */
export function geser(timurM: number, utaraM: number, asal: Titik = ASAL): Titik {
  return {
    lat: asal.lat + utaraM / M_PER_DERAJAT_LAT,
    lng: asal.lng + timurM / (M_PER_DERAJAT_LAT * Math.cos((asal.lat * Math.PI) / 180)),
  };
}

/** Persegi panjang (meter, relatif ASAL) sebagai Polygon GeoJSON. */
export function kotak(barat: number, selatan: number, timur: number, utara: number): GeometriArea {
  const t = (x: number, y: number) => {
    const p = geser(x, y);
    return [p.lng, p.lat] as [number, number];
  };
  return { type: "Polygon", coordinates: [[t(barat, selatan), t(timur, selatan), t(timur, utara), t(barat, utara), t(barat, selatan)]] };
}

/** Kawasan 1000 × 1000 m; gedung A 100 × 60 m di dalamnya; gedung B (terbatas) di sebelahnya. */
export const KAWASAN = kotak(0, 0, 1000, 1000);
export const GEDUNG_A = kotak(400, 400, 500, 460);
export const GEDUNG_B = kotak(600, 400, 650, 450);
