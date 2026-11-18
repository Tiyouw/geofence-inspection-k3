import { describe, expect, it } from "vitest";
import { bacaCapKoordinat, barisCap, labelGpsCap } from "../cap";

describe("cap foto", () => {
  it("menyusun waktu, area dan kode, inspektur dan GPS; koordinat hanya bila diberikan", () => {
    const b = barisCap({
      waktu: "2026-11-18T02:42:00Z",
      area: "Bengkel Fabrikasi B",
      kode: "APAR-B-014",
      inspektur: "Dimas Pratama",
      akurasiM: 8,
    });
    expect(b).toHaveLength(3);
    expect(b[0]).toMatch(/18 Nov 2026.*09[.:]42 WIB/);
    expect(b[1]).toBe("Bengkel Fabrikasi B · APAR-B-014");
    expect(b[2]).toBe("Dimas Pratama · GPS baik ±8 m");
    const k = barisCap({ waktu: null, area: null, kode: "X", inspektur: null, akurasiM: null, koordinat: { lat: -6.1, lng: 106.5 } });
    expect(k[1]).toBe("X");
    expect(k[2]).toBe("Tanpa GPS");
    expect(k[3]).toBe("-6.100000, 106.500000");
  });

  it("GPS lemah di atas ambang", () => {
    expect(labelGpsCap(140)).toBe("GPS lemah ±140 m");
    expect(labelGpsCap(100)).toBe("GPS baik ±100 m");
    expect(labelGpsCap(60, 50)).toBe("GPS lemah ±60 m");
  });

  it("pengaturan koordinat bawaan mati", () => {
    expect(bacaCapKoordinat(undefined)).toBe(false);
    expect(bacaCapKoordinat(false)).toBe(false);
    expect(bacaCapKoordinat(true)).toBe(true);
  });
});
