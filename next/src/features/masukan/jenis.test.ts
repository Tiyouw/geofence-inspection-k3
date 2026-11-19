import { describe, expect, it } from "vitest";
import { barisCsv, periksaGambar, selCsv, skemaMasukan } from "./jenis";

describe("skemaMasukan", () => {
    it("nama kosong menjadi Faldy, langkah kosong menjadi null", () => {
        const r = skemaMasukan.parse({ nama: "  ", jenis: "bug", konteks: "Langkah 3", langkah: "", isi: "Tombol tidak bisa diklik" });
        expect(r.nama).toBe("Faldy");
        expect(r.langkah).toBeNull();
    });
    it("menolak jenis tak dikenal dan isi terlalu pendek", () => {
        expect(skemaMasukan.safeParse({ nama: "A", jenis: "spam", isi: "abcdef" }).success).toBe(false);
        expect(skemaMasukan.safeParse({ nama: "A", jenis: "saran", isi: "ok" }).success).toBe(false);
    });
    it("menolak id langkah dengan karakter aneh", () => {
        expect(skemaMasukan.safeParse({ nama: "A", jenis: "tanya", isi: "kenapa begini", langkah: "../x" }).success).toBe(false);
    });
});

describe("periksaGambar", () => {
    it("hanya gambar JPG/PNG/WebP sampai 3 MB", () => {
        expect(periksaGambar({ type: "image/jpeg", size: 200_000 }).ok).toBe(true);
        expect(periksaGambar({ type: "image/svg+xml", size: 2_000 }).ok).toBe(false);
        expect(periksaGambar({ type: "image/png", size: 4 * 1024 * 1024 }).ok).toBe(false);
        expect(periksaGambar({ type: "image/png", size: 0 }).ok).toBe(false);
    });
});

describe("CSV", () => {
    it("mengutip, menggandakan tanda kutip, dan menetralkan rumus", () => {
        expect(selCsv('kata "aneh"')).toBe('"kata ""aneh"""');
        expect(selCsv("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
        expect(selCsv(null)).toBe('""');
        expect(barisCsv(["a", 1])).toBe('"a","1"');
    });
});
