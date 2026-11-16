import { describe, expect, it } from "vitest";
import { bolehLihatFoto, kunciFoto, sha256Hex } from "./photos";

describe("foto bukti", () => {
  it("admin dan pemantau melihat semua foto; inspektur hanya miliknya", () => {
    expect(bolehLihatFoto({ id: 1, role: "admin" }, 9)).toBe(true);
    expect(bolehLihatFoto({ id: 2, role: "pemantau" }, 9)).toBe(true);
    expect(bolehLihatFoto({ id: 9, role: "inspektur" }, 9)).toBe(true);
    expect(bolehLihatFoto({ id: 3, role: "inspektur" }, 9)).toBe(false);
  });

  it("kunci dan hash", () => {
    expect(kunciFoto("abc", "def")).toBe("inspeksi/abc/def.jpg");
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
