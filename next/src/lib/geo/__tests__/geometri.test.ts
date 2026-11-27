import { describe, expect, it } from "vitest";
import {
  cincinBersilangan,
  jarakKeAreaM,
  jarakKeTepiM,
  luasM2,
  MAKS_TITIK_POLIGON,
  normalkanGeometri,
  titikDalamPoligon,
  validasiGeometri,
  type GeometriArea,
} from "../geometri";
import { GEDUNG_A, geser, kotak } from "./contoh";

describe("titikDalamPoligon", () => {
  it("di dalam, di luar, dan tepat di tepi", () => {
    expect(titikDalamPoligon(geser(450, 430), GEDUNG_A)).toBe(true);
    expect(titikDalamPoligon(geser(550, 430), GEDUNG_A)).toBe(false);
    expect(titikDalamPoligon(geser(450, 470), GEDUNG_A)).toBe(false);
    const sudut = GEDUNG_A.type === "Polygon" ? GEDUNG_A.coordinates[0][0] : [0, 0];
    expect(titikDalamPoligon({ lng: sudut[0], lat: sudut[1] }, GEDUNG_A)).toBe(true);
  });

  it("poligon cekung (bentuk L)", () => {
    const L: GeometriArea = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [2, 0],
          [2, 1],
          [1, 1],
          [1, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    };
    expect(titikDalamPoligon({ lng: 0.5, lat: 1.5 }, L)).toBe(true);
    expect(titikDalamPoligon({ lng: 1.5, lat: 1.5 }, L)).toBe(false);
  });

  it("lubang tidak dihitung di dalam", () => {
    const luar = kotak(0, 0, 100, 100);
    const lubang = kotak(40, 40, 60, 60);
    const g: GeometriArea = {
      type: "Polygon",
      coordinates: [(luar as { coordinates: [number, number][][] }).coordinates[0], (lubang as { coordinates: [number, number][][] }).coordinates[0]],
    };
    expect(titikDalamPoligon(geser(10, 10), g)).toBe(true);
    expect(titikDalamPoligon(geser(50, 50), g)).toBe(false);
  });

  it("MultiPolygon: di salah satu bagian", () => {
    const a = (kotak(0, 0, 10, 10) as { coordinates: [number, number][][] }).coordinates;
    const b = (kotak(100, 0, 110, 10) as { coordinates: [number, number][][] }).coordinates;
    const g: GeometriArea = { type: "MultiPolygon", coordinates: [a, b] };
    expect(titikDalamPoligon(geser(105, 5), g)).toBe(true);
    expect(titikDalamPoligon(geser(50, 5), g)).toBe(false);
  });
});

describe("jarak ke tepi (meter)", () => {
  it("titik di luar: jarak tegak lurus ke sisi terdekat", () => {
    expect(jarakKeTepiM(geser(530, 430), GEDUNG_A)).toBeCloseTo(30, 0);
    expect(jarakKeTepiM(geser(450, 560), GEDUNG_A)).toBeCloseTo(100, 0);
  });

  it("titik di luar sudut: jarak ke simpul", () => {
    expect(jarakKeTepiM(geser(530, 500), GEDUNG_A)).toBeCloseTo(50, 0); // 30-40-50
  });

  it("titik di dalam: jarak ke tepi, tetapi jarak ke area 0", () => {
    expect(jarakKeTepiM(geser(410, 430), GEDUNG_A)).toBeCloseTo(10, 0);
    expect(jarakKeAreaM(geser(410, 430), GEDUNG_A)).toBe(0);
  });

  it("jarak jauh tetap masuk akal (2 km)", () => {
    expect(jarakKeTepiM(geser(2500, 430), GEDUNG_A)).toBeCloseTo(2000, -1);
  });
});

describe("luas", () => {
  it("persegi panjang 100 × 60 m ≈ 6000 m²", () => {
    expect(luasM2(GEDUNG_A)).toBeGreaterThan(5990);
    expect(luasM2(GEDUNG_A)).toBeLessThan(6010);
  });
});

describe("validasiGeometri", () => {
  it("poligon sah", () => {
    expect(validasiGeometri(GEDUNG_A)).toEqual({ sah: true });
  });

  it("garis saling memotong (pita kupu-kupu)", () => {
    const pita = {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 1],
          [1, 0],
          [0, 1],
          [0, 0],
        ],
      ],
    };
    expect(cincinBersilangan(pita.coordinates[0] as [number, number][])).toBe(true);
    expect(validasiGeometri(pita)).toEqual({ sah: false, pesan: "Poligon tidak sah: garis saling memotong." });
  });

  it("kurang dari tiga titik, jenis salah, koordinat di luar WGS84", () => {
    expect(validasiGeometri({ type: "Polygon", coordinates: [[[0, 0], [1, 1], [0, 0]]] }).sah).toBe(false);
    expect(validasiGeometri({ type: "Point", coordinates: [0, 0] }).sah).toBe(false);
    expect(validasiGeometri({ type: "Polygon", coordinates: [[[0, 0], [500, 0], [1, 1], [0, 0]]] }).sah).toBe(false);
  });

  it(`lebih dari ${MAKS_TITIK_POLIGON} titik ditolak`, () => {
    const n = MAKS_TITIK_POLIGON + 1;
    const c = Array.from({ length: n }, (_, i) => [Math.cos((2 * Math.PI * i) / n), Math.sin((2 * Math.PI * i) / n)]);
    const r = validasiGeometri({ type: "Polygon", coordinates: [[...c, c[0]]] });
    expect(r.sah).toBe(false);
  });

  it("cincin yang belum ditutup diterima dan ditutup saat dinormalkan", () => {
    const terbuka = { type: "Polygon" as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]] as [number, number][]] };
    expect(validasiGeometri(terbuka).sah).toBe(true);
    const n = normalkanGeometri(terbuka);
    expect(n.type === "Polygon" && n.coordinates[0].length).toBe(5);
  });
});

describe("titikWakil", () => {
  it("titik tengah untuk poligon cembung, titik di dalam untuk poligon cekung (L)", async () => {
    const { titikWakil, titikDalamPoligon } = await import("../geometri");
    const kotak = { type: "Polygon" as const, coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] as [number, number][][] };
    expect(titikWakil(kotak)).toEqual({ lng: 1, lat: 1 });
    const L = {
      type: "Polygon" as const,
      coordinates: [[[0, 0], [10, 0], [10, 1], [1, 1], [1, 10], [0, 10], [0, 0]]] as [number, number][][],
    };
    const t = titikWakil(L)!;
    expect(titikDalamPoligon(t, L)).toBe(true);
  });
});
