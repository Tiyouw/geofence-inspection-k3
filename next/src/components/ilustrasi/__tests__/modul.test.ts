import { describe, expect, it } from "vitest";
import { modulDari } from "../modul";

describe("modulDari", () => {
  it("memetakan slug v2, slug lama, dan nama tipe ke ilustrasi", () => {
    expect(modulDari("apar")).toBe("apar");
    expect(modulDari("p3k")).toBe("p3k");
    expect(modulDari("hydrant_pilar")).toBe("hydrant_pilar");
    expect(modulDari("hydrant_box")).toBe("hydrant_box");
    expect(modulDari("hydrant")).toBe("hydrant_pilar");
    expect(modulDari("mobil_pemadam")).toBe("mobil_pemadam");
    expect(modulDari("damkar")).toBe("mobil_pemadam");
    expect(modulDari("Kotak P3K")).toBe("p3k");
    expect(modulDari("Hydrant Box")).toBe("hydrant_box");
    expect(modulDari(null)).toBe("apar");
  });
});
