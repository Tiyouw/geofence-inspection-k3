import { describe, expect, it } from "vitest";
import type { GeometriArea } from "@/lib/geo/geometri";
import { kotak } from "@/lib/geo/__tests__/contoh";
import { type AreaDraf, kalimatDilewati, pilahSetujuiMassal } from "../draf-massal";

const draf = (id: number, nama: string, g: GeometriArea | null, jenis = "gedung"): AreaDraf => ({ id, nama, jenis, polygon: null, polygonDraf: g });
const PITA: GeometriArea = { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]] };

describe("pilahSetujuiMassal", () => {
  const gedung = [1, 2, 3, 4, 5, 6].map((i) => draf(i, `Gedung ${i}`, kotak(i * 100, 100, i * 100 + 40, 140)));

  it("gedung biasa disetujui", () => {
    expect(pilahSetujuiMassal(gedung, gedung)).toEqual({ setujui: [1, 2, 3, 4, 5, 6], kawasan: [], tidakSah: [] });
  });

  it("melewati calon kawasan: jenis kawasan, nama berisi kawasan, atau memuat banyak area lain", () => {
    const luas = draf(10, "Batas denah", kotak(0, 0, 1000, 1000));
    const bernama = draf(11, "Kawasan Galangan (denah)", kotak(5000, 5000, 5100, 5100));
    const berjenis = draf(12, "Batas", kotak(6000, 6000, 6100, 6100), "kawasan");
    const semua = [...gedung, luas, bernama, berjenis];
    const p = pilahSetujuiMassal(semua, semua);
    expect(p.kawasan.sort()).toEqual([10, 11, 12]);
    expect(p.setujui).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("poligon yang memuat kurang dari 5 area tetap gedung", () => {
    const kompleks = draf(20, "Kompleks bengkel", kotak(50, 50, 380, 200));
    const p = pilahSetujuiMassal([kompleks], [...gedung, kompleks]);
    expect(p.setujui).toEqual([20]);
  });

  it("melewati geometri tidak sah atau kosong, dengan pesannya", () => {
    const p = pilahSetujuiMassal([draf(30, "Pita", PITA), draf(31, "Kosong", null)], gedung);
    expect(p.setujui).toEqual([]);
    expect(p.tidakSah).toEqual([
      { id: 30, pesan: "Poligon tidak sah: garis saling memotong." },
      { id: 31, pesan: "Geometri kosong." },
    ]);
  });

  it("kalimat alasan", () => {
    expect(kalimatDilewati({ kawasan: [1], tidakSah: [{ id: 2, pesan: "" }, { id: 3, pesan: "" }] })).toBe(
      '3 dilewati: 1 calon batas kawasan (setujui lewat "Jadikan batas kawasan"), 2 geometri tidak sah (garis saling memotong atau kosong).',
    );
    expect(kalimatDilewati({ kawasan: [], tidakSah: [] })).toBe("");
  });
});
