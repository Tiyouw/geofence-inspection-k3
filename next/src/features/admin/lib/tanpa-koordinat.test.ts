import { describe, expect, it } from "vitest";
import { tanpaKoordinat } from "./audit";

describe("tanpaKoordinat (dipakai catatAudit sebelum menyimpan)", () => {
    it("membuang lat/lng/poligon di semua kedalaman, kunci lain tetap", () => {
        const d = {
            kode: "01D",
            berubah: { lat: { dari: 1, ke: 2 }, areaId: { dari: 1, ke: 2 } },
            fitur: [{ geometry: {}, label: "A" }],
        };
        expect(tanpaKoordinat(d)).toEqual({
            kode: "01D",
            berubah: { areaId: { dari: 1, ke: 2 } },
            fitur: [{ label: "A" }],
        });
    });
});
