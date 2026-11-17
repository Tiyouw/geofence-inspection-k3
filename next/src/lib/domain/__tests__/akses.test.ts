import { describe, expect, it } from "vitest";
import { bolehInspeksiAset, bolehKelolaData, bolehLihatSemua, bolehMeninjau, pesanAsetUnitLain } from "../akses";

const SAT_PK = 1;
const MATRA = 2;

describe("bolehInspeksiAset (PRD F2)", () => {
  it("inspektur hanya aset milik unitnya", () => {
    expect(bolehInspeksiAset({ role: "inspektur", divisionId: SAT_PK }, SAT_PK)).toBe(true);
    expect(bolehInspeksiAset({ role: "inspektur", divisionId: MATRA }, SAT_PK)).toBe(false);
  });

  it("tanpa unit di akun atau di tipe aset: ditolak", () => {
    expect(bolehInspeksiAset({ role: "inspektur", divisionId: null }, SAT_PK)).toBe(false);
    expect(bolehInspeksiAset({ role: "inspektur", divisionId: SAT_PK }, null)).toBe(false);
  });

  it("admin dan pemantau tidak menginspeksi", () => {
    expect(bolehInspeksiAset({ role: "admin", divisionId: SAT_PK }, SAT_PK)).toBe(false);
    expect(bolehInspeksiAset({ role: "pemantau", divisionId: SAT_PK }, SAT_PK)).toBe(false);
  });
});

describe("peran (ADR-9)", () => {
  it("admin dan pemantau meninjau dan melihat semua; inspektur tidak", () => {
    expect(bolehMeninjau("admin")).toBe(true);
    expect(bolehMeninjau("pemantau")).toBe(true);
    expect(bolehMeninjau("inspektur")).toBe(false);
    expect(bolehLihatSemua("pemantau")).toBe(true);
    expect(bolehLihatSemua("inspektur")).toBe(false);
  });

  it("hanya admin mengelola data induk", () => {
    expect(bolehKelolaData("admin")).toBe(true);
    expect(bolehKelolaData("pemantau")).toBe(false);
    expect(bolehKelolaData("inspektur")).toBe(false);
  });
});

describe("pesanAsetUnitLain", () => {
  it("menyebut unit pemilik dan unit pengguna", () => {
    expect(pesanAsetUnitLain("Divisi Matra & K3LH", "SAT. PK")).toBe(
      "Aset ini milik Divisi Matra & K3LH. Anda hanya dapat menginspeksi aset SAT. PK.",
    );
    expect(pesanAsetUnitLain("SAT. PK", null)).toContain("belum terdaftar di unit kerja");
  });
});
