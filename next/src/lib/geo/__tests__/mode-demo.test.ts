import { describe, expect, it } from "vitest";
import { PENGATURAN_GERBANG_BAWAAN as P } from "../akurasi";
import { nilaiGerbang } from "../gerbang";
import { modeDemoAktif, modeDemoBerlaku, terapkanModeDemo } from "../mode-demo";
import { GEDUNG_A, geser, KAWASAN } from "./contoh";

const kawasan = { id: 1, nama: "Kawasan galangan", polygon: KAWASAN };
const gedungA = { id: 2, nama: "Bengkel Contoh A", polygon: GEDUNG_A };

/** Jauh di luar galangan (5 km), akurasi baik: gerbang menolak. */
const ditolak = nilaiGerbang({ posisi: { ...geser(5000, 5000), akurasi: 10 }, areaAset: gedungA, kawasan, bergerak: false, pengaturan: P });
const diblokir = nilaiGerbang({ posisi: null, areaAset: gedungA, kawasan, bergerak: false, pengaturan: P });

describe("modeDemoAktif / modeDemoBerlaku", () => {
  it("mati bawaan; hanya '1' yang menyalakan", () => {
    expect(modeDemoAktif({})).toBe(false);
    expect(modeDemoAktif({ AKUN_DEMO_LEWATI_KAWASAN: "" })).toBe(false);
    expect(modeDemoAktif({ AKUN_DEMO_LEWATI_KAWASAN: "true" })).toBe(false);
    expect(modeDemoAktif({ AKUN_DEMO_LEWATI_KAWASAN: "1" })).toBe(true);
  });

  it("butuh akun demo DAN sakelar", () => {
    expect(modeDemoBerlaku(true, { AKUN_DEMO_LEWATI_KAWASAN: "1" })).toBe(true);
    expect(modeDemoBerlaku(false, { AKUN_DEMO_LEWATI_KAWASAN: "1" })).toBe(false);
    expect(modeDemoBerlaku(true, {})).toBe(false);
  });
});

describe("terapkanModeDemo", () => {
  it("prasyarat: posisi uji memang ditolak gerbang", () => {
    expect(ditolak.hasil).toBe("ditolak");
  });

  it("akun sungguhan tetap ditolak walau sakelar menyala", () => {
    expect(terapkanModeDemo(ditolak, { isDemo: false, aktif: true })).toBe(ditolak);
  });

  it("akun demo + sakelar menyala: diterima sebagai perlu_tinjauan / mode_demo, jarak tetap tercatat", () => {
    const h = terapkanModeDemo(ditolak, { isDemo: true, aktif: true });
    expect(h).toMatchObject({ hasil: "diterima", status: "perlu_tinjauan", alasan: "mode_demo" });
    expect(h.jarakKeKawasanM).toBe(ditolak.jarakKeKawasanM);
    expect(h.jarakKeKawasanM).toBeGreaterThan(P.toleransiKawasanM);
  });

  it("akun demo + sakelar mati: tetap ditolak", () => {
    expect(terapkanModeDemo(ditolak, { isDemo: true, aktif: false })).toMatchObject({ hasil: "ditolak", status: null });
  });

  it("diblokir (tanpa GPS) tidak dikecualikan", () => {
    expect(terapkanModeDemo(diblokir, { isDemo: true, aktif: true })).toMatchObject({ hasil: "diblokir", status: null, alasan: null });
  });

  it("hasil yang sudah diterima tidak diubah", () => {
    const dalam = nilaiGerbang({ posisi: { ...geser(450, 430), akurasi: 8 }, areaAset: gedungA, kawasan, bergerak: false, pengaturan: P });
    expect(terapkanModeDemo(dalam, { isDemo: true, aktif: true })).toBe(dalam);
  });
});
