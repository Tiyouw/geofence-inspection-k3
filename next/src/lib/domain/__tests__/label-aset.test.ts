import { describe, expect, it } from "vitest";
import { labelLantai } from "../asset";
import { labelLokasi, labelMedia, namaArea } from "../label-aset";

/** ACCEPTANCE H4, setara tests/Unit/LabelLokasiAsetTest.php. */
describe("label lantai dan lokasi (H4)", () => {
  it("lantai yang sudah berawalan tidak diawali lagi", () => {
    expect(labelLantai("Lt. 1")).toBe("Lt. 1");
    expect(labelLantai("Lantai 3")).toBe("Lantai 3");
  });

  it("lantai angka saja tetap diawali", () => {
    expect(labelLantai("2")).toBe("Lt. 2");
  });

  it("penanda tanpa lantai menghasilkan null", () => {
    for (const p of ["-", "–", "—", "", "  ", null]) expect(labelLantai(p)).toBeNull();
  });

  it("menggabungkan titik dan lantai", () => {
    expect(labelLokasi({ lokasiTeks: "Lorong Timur titik 1", gedung: "Gedung PIP", lantai: "Lt. 1" })).toBe(
      "Lorong Timur titik 1 · Lt. 1",
    );
  });

  it("area terbuka tanpa ekor lantai", () => {
    expect(labelLokasi({ lokasiTeks: "Pos 1", gedung: "Area Terbuka", lantai: "-" })).toBe("Pos 1");
  });

  it("jatuh ke gedung saat titik kosong", () => {
    expect(labelLokasi({ lokasiTeks: null, gedung: "Workshop Fabrikasi", lantai: "3" })).toBe("Workshop Fabrikasi · Lt. 3");
  });

  it("tidak pernah kosong", () => {
    expect(labelLokasi({ lokasiTeks: null, gedung: null, lantai: null })).toBe("-");
  });
});

describe("namaArea dan labelMedia", () => {
  it("area memakai gedung dan lantai, dengan pengganti gedung kosong", () => {
    expect(namaArea({ gedung: "Gedung PIP", lantai: "1" })).toBe("Gedung PIP · Lt. 1");
    expect(namaArea({ gedung: null, lantai: "-" })).toBe("Area belum diisi");
  });

  it("media dengan kapasitas berkoma", () => {
    expect(labelMedia({ jenis: "Powder", kapasitas_kg: 3.5 })).toBe("Powder / 3,5 kg");
    expect(labelMedia({ tipe: "CO2" })).toBe("CO2");
    expect(labelMedia(null)).toBe("APAR");
  });
});
