import { describe, expect, it } from "vitest";
import {
  NilaiTakDikenal,
  idInspeksi,
  peran,
  statusGerbang,
  statusInspeksi,
  sudahBcrypt,
  tanggal,
  ukuranGambar,
  uuidv5,
  waktuWib,
} from "./peta";

describe("peta migrasi Laravel → v2 (SPEC §2.4)", () => {
  it("UUIDv5 sesuai RFC 4122 dan deterministik", () => {
    expect(uuidv5("www.example.com", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe("2ed6657d-e927-568b-95e1-2665a8aea6a2");
    expect(idInspeksi(42)).toBe(idInspeksi(42));
    expect(idInspeksi(42)).not.toBe(idInspeksi(43));
  });

  it("waktu SQLite tanpa zona dibaca sebagai WIB", () => {
    expect(waktuWib("2026-10-01 09:00:00")!.toISOString()).toBe("2026-10-01T02:00:00.000Z");
    expect(waktuWib("2026-10-01T09:00:00Z")!.toISOString()).toBe("2026-10-01T09:00:00.000Z");
    expect(waktuWib(null)).toBeNull();
    expect(tanggal("2026-10-30 00:00:00")).toBe("2026-10-30");
  });

  it("nilai lama dipetakan; nilai asing dilaporkan", () => {
    expect(peran("supervisor")).toBe("pemantau");
    expect(statusInspeksi("terkirim")).toBe("final");
    expect(statusInspeksi("draft")).toBe("draf");
    expect(statusGerbang("lolos")).toBe("sesuai");
    expect(() => statusGerbang("aneh")).toThrow(NilaiTakDikenal);
  });

  it("mengenali hash bcrypt Laravel", () => {
    expect(sudahBcrypt("$2y$12$" + "a".repeat(53))).toBe(true);
    expect(sudahBcrypt("admin123")).toBe(false);
  });

  it("membaca ukuran JPEG dan PNG dari header", () => {
    const jpeg = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      "base64",
    );
    expect(ukuranGambar(jpeg)).toEqual({ width: 1, height: 1, contentType: "image/jpeg" });
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg==", "base64");
    expect(ukuranGambar(png)).toEqual({ width: 1, height: 1, contentType: "image/png" });
    expect(ukuranGambar(Buffer.from("bukan gambar"))).toBeNull();
  });
});
