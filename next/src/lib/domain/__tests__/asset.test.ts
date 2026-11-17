import { describe, expect, it } from "vitest";
import { buatTokenQr, jarakMeter, labelLantai, tebakLokasiTipe } from "../asset";

describe("aturan aset", () => {
  it("jarak haversine kira-kira benar", () => {
    // 0.001 derajat lintang ~ 111 m
    expect(jarakMeter({ lat: -8.186, lng: 113.706 }, { lat: -8.187, lng: 113.706 })).toBe(111);
    expect(jarakMeter({ lat: null, lng: 1 }, { lat: 1, lng: 1 })).toBeNull();
  });

  it("label lantai dan jenis lokasi dari nama gedung", () => {
    expect(labelLantai("Lt. 1")).toBe("Lt. 1");
    expect(labelLantai("2")).toBe("Lt. 2");
    expect(labelLantai("-")).toBeNull();
    expect(tebakLokasiTipe("Workshop Fabrikasi")).toBe("bengkel");
    expect(tebakLokasiTipe("Area Terbuka")).toBe("area_terbuka");
    expect(tebakLokasiTipe("Gedung PIP")).toBe("dalam_gedung");
  });

  it("token QR acak dan berawalan", () => {
    const a = buatTokenQr();
    expect(a).toMatch(/^PAL-K3-[0-9a-f]{32}$/);
    expect(buatTokenQr()).not.toBe(a);
  });
});
