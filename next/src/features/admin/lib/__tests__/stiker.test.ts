import { describe, expect, it } from "vitest";
import { TATA_LETAK, cssStiker, parseSaringStiker, qsStiker, type KodeTata } from "../stiker";

describe("penyaring lembar stiker", () => {
    it("membaca jenis jamak, area (id atau belum), lantai, dan kode", () => {
        expect(parseSaringStiker({ tipe: "apar,p3k", area: "3", lantai: "Lt. 2", kode: "01D, 14A,," })).toEqual({
            tipe: ["apar", "p3k"],
            area: 3,
            lantai: "Lt. 2",
            kode: ["01D", "14A"],
        });
        expect(parseSaringStiker({ area: "belum" }).area).toBe("belum");
        // Nilai asing dibuang, bukan diteruskan ke kueri.
        expect(parseSaringStiker({ area: "3 or 1=1", tipe: "apar,Robert'); drop" })).toEqual({
            tipe: ["apar"],
            area: undefined,
            lantai: undefined,
            kode: [],
        });
    });

    it("query string bolak-balik dan tata letak bawaan tidak ditulis", () => {
        const f = { tipe: ["hydrant_box"], area: "belum" as const, lantai: "Lt. 1", kode: ["01D"] };
        const qs = qsStiker("3x8", f);
        expect(qs).toBe("?tata=3x8&tipe=hydrant_box&area=belum&lantai=Lt.+1&kode=01D");
        expect(parseSaringStiker(Object.fromEntries(new URLSearchParams(qs)))).toEqual(f);
        expect(qsStiker("2x5", { tipe: [], kode: [] })).toBe("");
    });
});

/**
 * Snapshot CSS cetak: ukuran label (mm), ukuran QR dengan quiet zone, dan penyembunyian kerangka
 * aplikasi saat mencetak. Snapshot berubah = hasil cetak berubah: ukur ulang di kertas label.
 */
describe("CSS cetak lembar stiker", () => {
    for (const kode of Object.keys(TATA_LETAK) as KodeTata[]) {
        it(`tata ${kode}`, () => {
            const css = cssStiker(kode);
            const t = TATA_LETAK[kode];
            expect(css).toContain(`grid-template-columns: repeat(${t.kolom}, ${t.lebar}mm); grid-auto-rows: ${t.tinggi}mm;`);
            expect(css).toContain(`.stiker-label { width: ${t.lebar}mm; height: ${t.tinggi}mm;`);
            const cetak = css.slice(css.indexOf("@media print"));
            expect(cetak).toMatchSnapshot();
            expect(css.match(/\.stiker-(lembar|label|qr svg) \{[^}]*\}/g)).toMatchSnapshot();
        });
    }
});
