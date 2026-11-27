import { describe, expect, it } from "vitest";
import { bacaGeoJson, kodeDariLabel } from "../impor";
import { GEDUNG_A, GEDUNG_B } from "./contoh";

const fc = (features: unknown[]) => ({ type: "FeatureCollection", features });

describe("bacaGeoJson", () => {
  it("membaca poligon berlabel dari berbagai nama properti", () => {
    const h = bacaGeoJson(
      JSON.stringify(
        fc([
          { type: "Feature", properties: { label: "Bengkel Contoh A" }, geometry: GEDUNG_A },
          { type: "Feature", properties: { name: "Gudang Contoh" }, geometry: GEDUNG_B },
          { type: "Feature", properties: {}, geometry: GEDUNG_B },
        ]),
      ),
    );
    expect(h.ok).toBe(true);
    if (!h.ok) return;
    expect(h.sah).toBe(3);
    expect(h.fitur.map((f) => f.label)).toEqual(["Bengkel Contoh A", "Gudang Contoh", null]);
  });

  it("fitur tidak sah ditandai satu per satu, sisanya tetap terbaca", () => {
    const h = bacaGeoJson(
      fc([
        { type: "Feature", properties: { label: "Titik" }, geometry: { type: "Point", coordinates: [0, 0] } },
        {
          type: "Feature",
          properties: { label: "Pita" },
          geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]] },
        },
        { type: "Feature", properties: { label: "A" }, geometry: GEDUNG_A },
      ]),
    );
    expect(h.ok && h.sah).toBe(1);
    expect(h.ok && h.fitur[1].galat).toBe("Poligon tidak sah: garis saling memotong.");
  });

  it("menolak berkas yang bukan GeoJSON, kosong, atau berkoordinat lokal", () => {
    expect(bacaGeoJson("bukan json")).toEqual({ ok: false, pesan: "Berkas bukan JSON yang sah." });
    expect(bacaGeoJson({ type: "Polygon" }).ok).toBe(false);
    expect(bacaGeoJson(fc([])).ok).toBe(false);
    const utm = { ...fc([{ type: "Feature", properties: {}, geometry: GEDUNG_A }]), crs: { type: "name", properties: { name: "EPSG:32749" } } };
    expect(bacaGeoJson(utm)).toMatchObject({ ok: false });
  });
});

describe("kodeDariLabel", () => {
  it("huruf besar, tanda hubung, cadangan bila kosong", () => {
    expect(kodeDariLabel("Bengkel Las 2", "AREA-1")).toBe("BENGKEL-LAS-2");
    expect(kodeDariLabel("  ", "AREA-1")).toBe("AREA-1");
  });
});
