import { describe, expect, it } from "vitest";
import { ASAL_UBIN, DAFTAR_UBIN, kunciUbin } from "./ubin";

describe("ubin peta", () => {
  it("bawaan tanpa label (CARTO), osm bisa dipilih lewat env", () => {
    expect(kunciUbin(undefined)).toBe("carto-polos");
    expect(kunciUbin("tidak-ada")).toBe("carto-polos");
    expect(kunciUbin("osm")).toBe("osm");
    expect(DAFTAR_UBIN["carto-polos"].url).toContain("light_nolabels");
  });
  it("atribusi OSM selalu ada; CSP mencakup semua asal", () => {
    for (const u of Object.values(DAFTAR_UBIN)) expect(u.atribusi).toContain("OpenStreetMap");
    expect(DAFTAR_UBIN["carto-polos"].atribusi).toContain("CARTO");
    expect(ASAL_UBIN).toEqual(["https://*.basemaps.cartocdn.com", "https://tile.openstreetmap.org"]);
  });
});
