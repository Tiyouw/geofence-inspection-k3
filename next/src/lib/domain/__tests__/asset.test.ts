import { describe, expect, it } from "vitest";
import { buatTokenQr, evaluasiGerbang, jarakMeter, labelLantai, radiusEfektif, tebakLokasiTipe } from "../asset";

describe("evaluasiGerbang (Bagian 5.6)", () => {
  it("menambahkan akurasi ke ambang radius", () => {
    expect(evaluasiGerbang({ radius: 30, jarak: 45, akurasi: 20 })).toBe("sesuai");
    expect(evaluasiGerbang({ radius: 30, jarak: 90, akurasi: 20 })).toBe("perlu_review");
    expect(evaluasiGerbang({ radius: 30, jarak: 120, akurasi: 20 })).toBe("jauh");
  });

  it("membedakan GPS lemah, tanpa GPS, dan objek bergerak", () => {
    expect(evaluasiGerbang({ radius: 75, jarak: 5, akurasi: 150 })).toBe("gps_lemah");
    expect(evaluasiGerbang({ radius: 75, jarak: null, akurasi: null })).toBe("tanpa_gps");
    expect(evaluasiGerbang({ radius: null, jarak: 999, akurasi: 5 })).toBe("tidak_berlaku");
  });
});

describe("aturan aset", () => {
  it("radius: override aset, lalu lokasi, lalu jenis lokasi", () => {
    expect(radiusEfektif({ radiusAset: 40, radiusLokasi: 50, lokasiTipe: "bengkel" })).toBe(40);
    expect(radiusEfektif({ radiusLokasi: 50, lokasiTipe: "bengkel" })).toBe(50);
    expect(radiusEfektif({ lokasiTipe: "area_terbuka" })).toBe(30);
    expect(radiusEfektif({ lokasiTipe: "kendaraan" })).toBeNull();
  });

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
