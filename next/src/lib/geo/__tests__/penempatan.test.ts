import { describe, expect, it } from "vitest";
import { jarakKeTepiM, titikDalamPoligon, type GeometriArea } from "../geometri";
import { type AsetTempat, type Bangunan, nomorDari, rencanaPenempatan, sisiDari, titikDinding } from "../penempatan";

/** Denah KARANGAN (meter → derajat di sekitar 0,0): bukan denah perusahaan. */
const D = 1 / 111_320;
const kotak = (x0: number, y0: number, x1: number, y1: number): GeometriArea => ({
  type: "Polygon",
  coordinates: [[[x0 * D, y0 * D], [x1 * D, y0 * D], [x1 * D, y1 * D], [x0 * D, y1 * D], [x0 * D, y0 * D]]],
});
const kawasan = kotak(0, 0, 600, 400);
const b = (id: number, nama: string, g: GeometriArea, restricted = false): Bangunan => ({ id, nama, polygon: g, restricted });
const bangunan = [
  b(1, "BENGLISH", kotak(40, 40, 140, 100)),
  b(2, "BENGMES 4", kotak(200, 40, 280, 100)),
  b(3, "BENG. KONS PIPA", kotak(320, 40, 400, 100), true),
  b(4, "KESIND", kotak(40, 200, 80, 240)),
  b(5, "SAT PK", kotak(300, 250, 330, 270)),
  b(6, "ASSEMBLY 3", kotak(450, 200, 550, 300)),
  b(7, "GUDANG LUAR", kotak(700, 700, 720, 720)),
];
const aset = (id: number, kode: string, slug: AsetTempat["slug"], kelompok: string | null, lokasiTeks: string, o: Partial<AsetTempat> = {}): AsetTempat => ({
  id,
  kode,
  slug,
  kelompok,
  lokasiTeks,
  lantai: "Lt. 1",
  areaTetap: null,
  terbatas: false,
  ...o,
});

describe("penempatan aset di denah (keputusan pemilik 19 Nov)", () => {
  it("teks lokasi: sisi dan nomor", () => {
    expect(sisiDari("Lorong Timur titik 3")).toBe("timur");
    expect(sisiDari("Ruang staf Lorong Tengah")).toBe("tengah");
    expect(sisiDari("Pantri")).toBeNull();
    expect(nomorDari("Bay 5 kolom tengah")).toBe(5);
    expect(nomorDari("Pos 2")).toBe(2);
  });

  it("titik dinding: di dalam gedung, dekat dinding sisi yang diminta, tidak bertumpuk", () => {
    const g = kotak(0, 0, 100, 40);
    const t = titikDinding(g, 4, "timur");
    expect(t).toHaveLength(4);
    for (const p of t) {
      expect(titikDalamPoligon(p, g)).toBe(true);
      expect(jarakKeTepiM(p, g)).toBeLessThan(2);
      expect(p.lng).toBeGreaterThan(95 * D);
    }
    const lng = t.map((p) => p.lat).sort();
    for (let i = 1; i < lng.length; i++) expect((lng[i]! - lng[i - 1]!) / D).toBeGreaterThan(3);
  });

  it("setiap modul ditempatkan sesuai aturan; semua di dalam kawasan; area terbatas hanya untuk yang sudah terbatas", () => {
    const daftar: AsetTempat[] = [
      ...Array.from({ length: 6 }, (_, i) => aset(10 + i, `0${i}D`, "apar", "Gedung PIP", `Lorong ${i < 3 ? "Timur" : "Barat"} titik ${i + 1}`)),
      aset(20, "HB-02", "hydrant_box", "Gedung PIP", "Lorong Barat dekat lift"),
      aset(21, "P3K-09", "p3k", "Area Terbuka", "Pos 1 jaga"),
      aset(22, "P3K-02", "p3k", "Gedung PIP", "Pantri Lorong Tengah"),
      aset(23, "HP-01", "hydrant_pilar", "Area Terbuka", "Halaman depan"),
      aset(24, "HP-02", "hydrant_pilar", "Area Terbuka", "Jalan utama"),
      // Lebih banyak pilar daripada bengkel: dua pilar di bengkel yang sama tidak boleh bertumpuk.
      aset(28, "HP-03", "hydrant_pilar", "Area Terbuka", "Dekat Pos 2"),
      aset(29, "HP-04", "hydrant_pilar", "Area Terbuka", "Sisi timur"),
      aset(25, "PMK-01", "mobil_pemadam", null, "Pos pemadam utama", { lantai: null }),
      aset(26, "DEMO-A07", "apar", "Gudang B3 Demo", "Rak", { terbatas: true }),
      aset(27, "01D", "apar", "ASSEMBLY 3", "Lorong Timur titik 1", { areaTetap: bangunan[5]! }),
    ];
    const r = rencanaPenempatan(daftar, { kawasan, bangunan });
    expect(r.size).toBe(daftar.length);
    for (const [id, t] of r) {
      expect(titikDalamPoligon(t, kawasan), `aset ${id} di kawasan`).toBe(true);
      if (t.areaId === 3) expect(id).toBe(26);
    }
    const g = (id: number) => bangunan.find((x) => x.id === r.get(id)!.areaId)!;
    // APAR/HB/P3K di dalam gedung yang menjadi areanya.
    for (const id of [10, 11, 12, 13, 14, 15, 20, 21, 22, 26, 27]) expect(titikDalamPoligon(r.get(id)!, g(id).polygon), `aset ${id}`).toBe(true);
    // Kelompok lama dipetakan utuh ke bengkel; "Lorong Timur" di dinding timur.
    expect(new Set([10, 11, 12, 13, 14, 15].map((id) => r.get(id)!.namaArea))).toEqual(new Set(["BENGLISH"]));
    expect(r.get(10)!.lng).toBeGreaterThan(130 * D);
    expect(r.get(13)!.lng).toBeLessThan(50 * D);
    expect(r.get(21)!.namaArea).toBe("KESIND");
    expect(r.get(27)!.namaArea).toBe("ASSEMBLY 3");
    // Pilar di luar semua gedung, dekat bengkel yang menjadi areanya.
    for (const id of [23, 24, 28, 29]) {
      const t = r.get(id)!;
      expect(bangunan.some((x) => titikDalamPoligon(t, x.polygon))).toBe(false);
      expect(jarakKeTepiM(t, g(id).polygon)).toBeLessThan(15);
      expect(g(id).nama).toMatch(/^BENG/);
    }
    // Mobil pemadam: tanpa area, terbuka, dekat SAT PK.
    const pmk = r.get(25)!;
    expect(pmk.areaId).toBeNull();
    expect(bangunan.some((x) => titikDalamPoligon(pmk, x.polygon))).toBe(false);
    expect(jarakKeTepiM(pmk, bangunan[4]!.polygon)).toBeLessThan(21);
    // Tidak ada dua aset bertumpuk (< 2 m).
    const ts = [...r.values()];
    for (let i = 0; i < ts.length; i++)
      for (let j = i + 1; j < ts.length; j++) expect(Math.hypot(ts[i]!.lat - ts[j]!.lat, ts[i]!.lng - ts[j]!.lng) / D).toBeGreaterThan(2);
  });

  it("deterministik", () => {
    const daftar = [aset(1, "01D", "apar", "Gedung PIP", "Lorong Timur titik 1"), aset(2, "HP-01", "hydrant_pilar", null, "Halaman")];
    expect([...rencanaPenempatan(daftar, { kawasan, bangunan })]).toEqual([...rencanaPenempatan(daftar, { kawasan, bangunan })]);
  });
});
