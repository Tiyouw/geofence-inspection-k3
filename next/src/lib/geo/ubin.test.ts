import { describe, expect, it } from "vitest";
import { ASAL_UBIN, DAFTAR_UBIN, kunciUbin } from "./ubin";

describe("ubin peta", () => {
  it("bawaan tanpa label (Esri kelabu), lain bisa dipilih lewat env", () => {
    expect(kunciUbin(undefined)).toBe("esri-kelabu");
    expect(kunciUbin("tidak-ada")).toBe("esri-kelabu");
    expect(kunciUbin("osm")).toBe("osm");
    expect(kunciUbin("carto-polos")).toBe("carto-polos");
    expect(DAFTAR_UBIN["esri-kelabu"].url).toContain("World_Light_Gray_Base");
  });
  it("atribusi OSM selalu ada; CSP mencakup semua asal", () => {
    for (const u of Object.values(DAFTAR_UBIN)) expect(u.atribusi).toContain("OpenStreetMap");
    expect(DAFTAR_UBIN["esri-kelabu"].atribusi).toContain("Esri");
    expect(DAFTAR_UBIN["carto-polos"].atribusi).toContain("CARTO");
    expect(ASAL_UBIN).toEqual([
      "https://server.arcgisonline.com",
      "https://*.basemaps.cartocdn.com",
      "https://tile.openstreetmap.org",
    ]);
  });
});
