import { describe, expect, it } from "vitest";
import {
  bacaPengaturanGerbang,
  KUNCI_PENGATURAN_GERBANG,
  labelJarak,
  mutuAkurasi,
  PENGATURAN_GERBANG_BAWAAN as P,
  toleransiGedungEfektif,
} from "../akurasi";
import { nilaiGerbang, perluDitinjau, pesanDitolak, pesanSinyalLemah, type MasukanGerbang } from "../gerbang";
import { GEDUNG_A, GEDUNG_B, geser, KAWASAN } from "./contoh";

const kawasan = { id: 1, nama: "Kawasan galangan", polygon: KAWASAN };
const gedungA = { id: 2, nama: "Bengkel Contoh A", polygon: GEDUNG_A };
const gedungB = { id: 3, nama: "Bengkel Contoh B", polygon: GEDUNG_B, restricted: true };

function gerbang(timur: number, utara: number, akurasi: number, ubah: Partial<MasukanGerbang> = {}) {
  return nilaiGerbang({
    posisi: { ...geser(timur, utara), akurasi },
    areaAset: gedungA,
    kawasan,
    bergerak: false,
    pengaturan: P,
    areaLain: [gedungA, gedungB],
    ...ubah,
  });
}

describe("nilaiGerbang: urutan aturan PRD", () => {
  it("1. aset bergerak: tidak berlaku, walau tanpa posisi", () => {
    const h = nilaiGerbang({ posisi: null, areaAset: null, kawasan, bergerak: true, pengaturan: P });
    expect(h).toMatchObject({ hasil: "diterima", status: "tidak_berlaku", alasan: null });
  });

  it("2. tanpa posisi (lokasi mati/izin ditolak): diblokir", () => {
    const h = nilaiGerbang({ posisi: null, areaAset: gedungA, kawasan, bergerak: false, pengaturan: P });
    expect(h).toMatchObject({ hasil: "diblokir", status: null });
  });

  it("2a. akurasi > 100 m: perlu tinjauan (GPS lemah), akurasi disimpan", () => {
    const h = gerbang(450, 430, 150);
    expect(h).toMatchObject({ hasil: "diterima", status: "perlu_tinjauan", alasan: "gps_lemah", akurasiM: 150 });
  });

  it("2a. akurasi lemah didahulukan walau posisi di luar galangan", () => {
    expect(gerbang(5000, 5000, 400)).toMatchObject({ hasil: "diterima", alasan: "gps_lemah" });
  });

  it("akurasi tepat 100 m belum dianggap lemah", () => {
    expect(gerbang(450, 430, 100)).toMatchObject({ status: "sesuai" });
  });

  it("3. di dalam poligon gedung: sesuai", () => {
    const h = gerbang(450, 430, 8);
    expect(h).toMatchObject({ hasil: "diterima", status: "sesuai", jarakKeAreaM: 0, areaTerdeteksiId: 2 });
  });

  it("3. di luar gedung tetapi dalam min(akurasi, 30 m): sesuai", () => {
    expect(gerbang(520, 430, 25)).toMatchObject({ status: "sesuai", jarakKeAreaM: 20 });
    expect(gerbang(528, 430, 60)).toMatchObject({ status: "sesuai", jarakKeAreaM: 28 });
  });

  it("3. akurasi baik tidak memberi kelonggaran melebihi galatnya", () => {
    // 20 m dari tepi, tetapi akurasi ±5 m: posisi sebenarnya tidak mungkin di dalam gedung.
    expect(gerbang(520, 430, 5)).toMatchObject({ status: "perlu_tinjauan", alasan: "di_luar_gedung" });
  });

  it("3. kelonggaran dibatasi 30 m", () => {
    expect(gerbang(535, 430, 90)).toMatchObject({ status: "perlu_tinjauan", alasan: "di_luar_gedung", jarakKeAreaM: 35 });
  });

  it("4. di dalam kawasan, di luar gedung: perlu tinjauan", () => {
    const h = gerbang(100, 100, 10);
    expect(h).toMatchObject({ hasil: "diterima", status: "perlu_tinjauan", alasan: "di_luar_gedung", jarakKeKawasanM: 0 });
    expect(h.jarakKeAreaM).toBeGreaterThan(300);
  });

  it("4. sedikit di luar kawasan (≤ 50 m): masih perlu tinjauan", () => {
    expect(gerbang(1040, 500, 10)).toMatchObject({ hasil: "diterima", status: "perlu_tinjauan", jarakKeKawasanM: 40 });
  });

  it("5. jauh di luar galangan (> 50 m dari batas): ditolak", () => {
    const h = gerbang(1060, 500, 10);
    expect(h).toMatchObject({ hasil: "ditolak", status: null, jarakKeKawasanM: 60 });
    expect(gerbang(4000, 500, 10).hasil).toBe("ditolak");
  });

  it("area terdeteksi: area terkecil yang memuat posisi, bukan area aset", () => {
    expect(gerbang(620, 420, 10)).toMatchObject({ status: "perlu_tinjauan", areaTerdeteksiId: 3 });
  });

  it("aset di area terbatas ditandai dan masuk antrean tinjauan walau lokasi sesuai", () => {
    const h = gerbang(620, 420, 10, { areaAset: gedungB });
    expect(h).toMatchObject({ status: "sesuai", areaTerbatas: true });
    expect(perluDitinjau(h)).toBe(true);
    expect(perluDitinjau(gerbang(450, 430, 8))).toBe(false);
  });

  it("aset tanpa poligon area: tidak pernah sesuai, kawasan tetap menolak", () => {
    expect(gerbang(450, 430, 8, { areaAset: { id: 9, nama: "X", polygon: null } })).toMatchObject({
      status: "perlu_tinjauan",
      jarakKeAreaM: null,
    });
    expect(gerbang(4000, 430, 8, { areaAset: null }).hasil).toBe("ditolak");
  });

  it("tanpa poligon kawasan: gerbang tidak menolak, diterima untuk ditinjau", () => {
    expect(gerbang(4000, 430, 8, { kawasan: null })).toMatchObject({ hasil: "diterima", status: "perlu_tinjauan" });
  });

  it("akurasi tidak sah diperlakukan sebagai lemah", () => {
    expect(gerbang(450, 430, Number.NaN)).toMatchObject({ alasan: "gps_lemah", akurasiM: null });
  });

  it("toleransi dibaca dari pengaturan, bukan konstanta", () => {
    const longgar = { ...P, toleransiKawasanM: 100 };
    expect(gerbang(1060, 500, 10, { pengaturan: longgar }).hasil).toBe("diterima");
    const ketat = { ...P, akurasiLemahM: 20 };
    expect(gerbang(450, 430, 25, { pengaturan: ketat }).alasan).toBe("gps_lemah");
  });
});

describe("akurasi dan pengaturan", () => {
  it("mutu dan toleransi efektif", () => {
    expect(mutuAkurasi(101, P)).toBe("lemah");
    expect(mutuAkurasi(100, P)).toBe("baik");
    expect(toleransiGedungEfektif(12, P)).toBe(12);
    expect(toleransiGedungEfektif(80, P)).toBe(30);
  });

  it("pengaturan dari baris settings; nilai rusak memakai bawaan", () => {
    expect(
      bacaPengaturanGerbang({
        [KUNCI_PENGATURAN_GERBANG.toleransiGedungM]: "25",
        [KUNCI_PENGATURAN_GERBANG.toleransiKawasanM]: "abc",
        [KUNCI_PENGATURAN_GERBANG.akurasiLemahM]: -5,
      }),
    ).toEqual({ toleransiGedungM: 25, toleransiKawasanM: 50, akurasiLemahM: 100 });
  });
});

describe("pesan", () => {
  it("ditolak menyebut jarak dari batas", () => {
    expect(pesanDitolak(1250)).toBe(
      "Posisi Anda berada di luar kawasan galangan (1,3 km dari batas). Inspeksi tidak dapat dikirim. Kirim ulang dari lokasi aset.",
    );
    expect(labelJarak(60)).toBe("60 m");
  });

  it("sinyal lemah menjelaskan sebab dan saran", () => {
    const s = pesanSinyalLemah(143.6);
    expect(s).toContain("±144 m");
    for (const kata of ["beratap baja", "lambung kapal", "kamar mesin", "crane", "hemat baterai", "baru dinyalakan", "pintu"]) {
      expect(s).toContain(kata);
    }
  });
});
