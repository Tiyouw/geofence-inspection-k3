import { describe, expect, it } from "vitest";
import { type GeometriArea, jarakKeTepiM, titikDalamPoligon, titikLabel, titikTengah } from "../geometri";
import { GEDUNG_A, geser, kotak } from "./contoh";

const ll = (t: { lng: number; lat: number }) => [t.lng, t.lat] as [number, number];

/** Gedung bentuk L 100 x 100 m dengan kaki 20 m: titik tengah simpulnya jatuh di luar. */
const BENTUK_L: GeometriArea = {
  type: "Polygon",
  coordinates: [[geser(0, 0), geser(100, 0), geser(100, 20), geser(20, 20), geser(20, 100), geser(0, 100), geser(0, 0)].map(ll)],
};

describe("titikLabel (kutub ketakterjangkauan)", () => {
  it("kotak: di tengah", () => {
    const t = titikLabel(GEDUNG_A)!;
    const tengah = geser(450, 430);
    expect(Math.abs(t.lat - tengah.lat) * 111_195).toBeLessThan(2);
    expect(Math.abs(t.lng - tengah.lng) * 111_195).toBeLessThan(2);
  });

  it("bentuk L: tetap di dalam gedung, sedangkan titik tengah simpul di luar", () => {
    expect(titikDalamPoligon(titikTengah(BENTUK_L)!, BENTUK_L)).toBe(false);
    const t = titikLabel(BENTUK_L)!;
    expect(titikDalamPoligon(t, BENTUK_L)).toBe(true);
    // ~10 m dari tepi: tepat di tengah kaki selebar 20 m
    expect(jarakKeTepiM(t, BENTUK_L)).toBeGreaterThan(9);
  });

  it("MultiPolygon: di bagian terluas", () => {
    const kecil = kotak(0, 0, 10, 10);
    const besar = kotak(200, 200, 300, 300);
    const g: GeometriArea = {
      type: "MultiPolygon",
      coordinates: [kecil, besar].map((x) => (x.type === "Polygon" ? x.coordinates : [])),
    };
    expect(titikDalamPoligon(titikLabel(g)!, besar)).toBe(true);
  });
});
