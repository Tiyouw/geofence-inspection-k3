import { describe, expect, it } from "vitest";
import { PENGATURAN_GERBANG_BAWAAN } from "../../lib/geo/akurasi";
import { titikDalamPoligon, validasiGeometri } from "../../lib/geo/geometri";
import { nilaiGerbang } from "../../lib/geo/gerbang";
import { AKUN_DEMO, AREA_DEMO, ASET_DEMO, AWALAN_DEMO, SKENARIO_DEMO, keLngLat } from "./demo-data";

const titik = (p: [number, number]) => {
  const [lng, lat] = keLngLat(...p);
  return { lat, lng };
};
const area = (kode: string) => AREA_DEMO.find((a) => a.kode === kode)!;
const kawasan = AREA_DEMO.find((a) => a.jenis === "kawasan")!;
const gerbang = (a: (typeof AREA_DEMO)[number]) => ({ id: AREA_DEMO.indexOf(a) + 1, nama: a.nama, polygon: a.geometri, restricted: a.restricted });

describe("data demo", () => {
  it("semua area dan aset bertanda DEMO- dan kodenya muat (<= 32)", () => {
    for (const k of [...AREA_DEMO.map((a) => a.kode), ...ASET_DEMO.map((a) => a.kode)]) {
      expect(k.startsWith(AWALAN_DEMO)).toBe(true);
      expect(k.length).toBeLessThanOrEqual(32);
    }
    expect(new Set(ASET_DEMO.map((a) => a.kode)).size).toBe(ASET_DEMO.length);
  });

  it("poligon sah; gedung di dalam kawasan; ada area terbatas dan satu draf", () => {
    for (const a of AREA_DEMO) {
      expect(validasiGeometri(a.geometri)).toEqual({ sah: true });
      if (a.jenis !== "kawasan" && a.geometri.type === "Polygon")
        for (const [lng, lat] of a.geometri.coordinates[0]!) expect(titikDalamPoligon({ lat, lng }, kawasan.geometri)).toBe(true);
    }
    expect(AREA_DEMO.some((a) => a.restricted)).toBe(true);
    expect(AREA_DEMO.filter((a) => !a.disetujui)).toHaveLength(1);
  });

  it("aset di dalam areanya; ada yang belum berarea dan belum ada koordinat; semua modul ada", () => {
    for (const a of ASET_DEMO) if (a.area && a.titik) expect(titikDalamPoligon(titik(a.titik), area(a.area).geometri), a.kode).toBe(true);
    expect(ASET_DEMO.some((a) => !a.area && a.titik && a.tipe !== "mobil_pemadam")).toBe(true);
    expect(ASET_DEMO.some((a) => !a.titik)).toBe(true);
    expect(new Set(ASET_DEMO.map((a) => a.tipe))).toEqual(new Set(["apar", "p3k", "hydrant_pilar", "hydrant_box", "mobil_pemadam"]));
  });

  it("hasil gerbang tiap skenario sama dengan fungsi gerbang sungguhan", () => {
    for (const sk of SKENARIO_DEMO) {
      const def = ASET_DEMO.find((a) => a.kode === sk.aset)!;
      const h = nilaiGerbang({
        posisi: { ...titik(sk.posisi), akurasi: sk.akurasi },
        areaAset: def.area ? gerbang(area(def.area)) : null,
        kawasan: gerbang(kawasan),
        bergerak: def.tipe === "mobil_pemadam",
        pengaturan: PENGATURAN_GERBANG_BAWAAN,
      });
      const label = `${sk.aset} ${sk.jamLalu}`;
      if (sk.ditolak) expect(h.hasil, label).toBe("ditolak");
      else expect({ status: h.status, alasan: h.alasan }, label).toEqual({ status: sk.gate, alasan: sk.alasan ?? null });
    }
  });

  it("skenario mencakup setiap hasil: diterima, perlu tinjauan per alasan, ditinjau, ditolak, area terbatas, bulan lalu", () => {
    const final = SKENARIO_DEMO.filter((s) => !s.ditolak);
    expect(final.some((s) => s.gate === "sesuai")).toBe(true);
    expect(final.some((s) => s.gate === "tidak_berlaku")).toBe(true);
    for (const alasan of ["di_luar_gedung", "gps_lemah"]) expect(final.some((s) => s.alasan === alasan && !s.tinjauan)).toBe(true);
    expect(final.some((s) => s.tinjauan?.hasil === "diterima")).toBe(true);
    expect(final.some((s) => s.tinjauan?.hasil === "ditolak")).toBe(true);
    expect(SKENARIO_DEMO.some((s) => s.ditolak)).toBe(true);
    expect(final.some((s) => area(ASET_DEMO.find((a) => a.kode === s.aset)!.area ?? "DEMO-KAWASAN").restricted)).toBe(true);
    expect(final.some((s) => s.bulanLalu)).toBe(true);
    expect(new Set(AKUN_DEMO.map((a) => a.unit))).toEqual(new Set(["SATPK", "MATRA"]));
  });
});
