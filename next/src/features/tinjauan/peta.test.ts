import { describe, expect, it } from "vitest";
import { batasTinjauan } from "./peta";

const kotak = (w: number, s: number, e: number, n: number) => ({
  type: "Polygon" as const,
  coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] as [number, number][][],
});
const dalam = (b: [[number, number], [number, number]], lat: number, lng: number) =>
  lat >= b[0][0] && lat <= b[1][0] && lng >= b[0][1] && lng <= b[1][1];

describe("batas peta tinjauan (bug 19 Nov: area aset tidak tampil)", () => {
  const gedung = kotak(112.737, -7.2025, 112.7375, -7.202);
  const kawasan = kotak(112.73, -7.21, 112.745, -7.195);

  it("membingkai poligon gedung, posisi inspektur, dan lingkaran akurasinya", () => {
    const b = batasTinjauan({ area: gedung, kawasan: null, aset: null, inspektur: { lat: -7.2016, lng: 112.7378, akurasi: 25 } })!;
    expect(dalam(b, -7.2025, 112.737)).toBe(true);
    expect(dalam(b, -7.202, 112.7375)).toBe(true);
    expect(dalam(b, -7.2016 + 24 / 111320, 112.7378)).toBe(true);
  });

  it("kawasan dekat ikut dibingkai; kawasan jauh (lain kota) tidak menarik peta", () => {
    const dekat = batasTinjauan({ area: gedung, kawasan, aset: null, inspektur: null })!;
    expect(dalam(dekat, -7.21, 112.73)).toBe(true);
    const jauh = batasTinjauan({ area: null, kawasan, aset: { lat: -8.186, lng: 113.706 }, inspektur: { lat: -8.1862, lng: 113.7063, akurasi: 12 } })!;
    expect(dalam(jauh, -7.2, 112.735)).toBe(false);
    expect(dalam(jauh, -8.186, 113.706)).toBe(true);
    expect(dalam(jauh, -8.1862, 113.7063)).toBe(true);
  });

  it("tanpa poligon area: titik aset dipakai; tanpa apa pun: null", () => {
    expect(batasTinjauan({ area: null, kawasan: null, aset: { lat: -7.2, lng: 112.7 }, inspektur: null })).not.toBeNull();
    expect(batasTinjauan({ area: null, kawasan: null, aset: null, inspektur: null })).toBeNull();
  });
});
