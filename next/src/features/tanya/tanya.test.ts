import { describe, expect, it } from "vitest";
import { jawabanKeMarkdown } from "./markdown";
import { BAGIAN, BAHAN_DIBAWA, CARA_MENJAWAB, PERTANYAAN } from "./pertanyaan";
import type { JawabanAda } from "./types";

const j = (s: Partial<JawabanAda>): JawabanAda => ({
    jawaban: "",
    pilihan: null,
    pakaiBawaan: false,
    perluTanya: false,
    lampiran: [],
    diubahPada: null,
    ...s,
});

describe("data pertanyaan dari catatan", () => {
    it("73 pertanyaan, 15 WAJIB, 9 bagian, nomor unik, semua field terisi", () => {
        expect(PERTANYAAN).toHaveLength(73);
        expect(PERTANYAAN.filter((p) => p.wajib)).toHaveLength(15);
        expect(BAGIAN).toHaveLength(9);
        expect(new Set(PERTANYAAN.map((p) => p.nomor)).size).toBe(73);
        for (const p of PERTANYAAN) {
            expect(p.teks && p.kenapa && p.bawaan && p.memblokir, p.nomor).toBeTruthy();
            expect(BAGIAN.some((b) => b.nomor === p.bagian)).toBe(true);
        }
        expect(BAHAN_DIBAWA.length).toBeGreaterThan(0);
        expect(CARA_MENJAWAB.length).toBeGreaterThan(0);
    });

    it("pilihan a)/b)/c) dipecah menjadi opsi", () => {
        const p = PERTANYAAN.find((q) => q.nomor === "1.2")!;
        expect(p.pilihan.map((o) => o.kode)).toEqual(["a", "b", "c"]);
    });
});

describe("ekspor Markdown", () => {
    const md = jawabanKeMarkdown(
        {
            "1.2": j({ pilihan: "c", jawaban: "Setuju.\nMobil pemadam tanpa gerbang." }),
            "1.4": j({ pakaiBawaan: true, perluTanya: true }),
            "1.1": j({ lampiran: [{ id: "abc", nama: "form.jpg", contentType: "image/jpeg", bytes: 10 }] }),
        },
        { dikirimPada: null, dibuatPada: new Date("2026-11-17T03:00:00Z"), urlLampiran: (id) => `https://x/l/${id}` },
    );

    it("urut sesuai penomoran catatan dan menandai WAJIB", () => {
        expect(md.indexOf("### 1.1 (WAJIB)")).toBeLessThan(md.indexOf("### 1.2 (WAJIB)"));
        expect(md.indexOf("## 1. ")).toBeLessThan(md.indexOf("## 9. "));
        expect(md).toContain("3 dari 73 pertanyaan terisi. Belum dikirim.");
    });

    it("memuat pilihan, jawaban multi-baris, bawaan, tanda perlu tanya, lampiran, dan asumsi untuk yang kosong", () => {
        expect(md).toContain("- **Pilihan:** c) 3 modul penuh");
        expect(md).toContain("- **Jawaban:** Setuju.\n  Mobil pemadam tanpa gerbang.");
        expect(md).toMatch(/### 1\.4 \(WAJIB\)[\s\S]*?\*\*Memakai bawaan:\*\*[\s\S]*?Perlu tanya pembimbing/);
        expect(md).toContain("- Lampiran: [form.jpg](https://x/l/abc)");
        expect(md).toMatch(/### 1\.3\n\n> .*\n\n- \*\*Jawaban:\*\* belum dijawab\. Bawaan: .*\{\{Assumption\}\}/);
    });
});
