import { describe, expect, it } from "vitest";
import { rakitProgres } from "@/features/dasbor/rakit";
import { filterRekap, lingkupRekap, namaBerkasRekap, parseFilterTemuan } from "../filter";
import { kolomTandaTangan, rakitRekapTemuan, type TemuanRekap } from "../rekap";

const t = (o: Partial<TemuanRekap>): TemuanRekap => ({
    id: 1,
    asetId: 1,
    asetKode: "01D",
    modul: "APAR",
    lokasi: "Gedung A",
    item: "Label: Tidak ada",
    severity: "ringan",
    tindakan: "lengkapi",
    uraianTindakan: null,
    waktu: new Date("2026-11-10T02:00:00Z"),
    inspektur: "Ina",
    berulang: 1,
    ...o,
});

describe("saringan temuan", () => {
    it("membuang nilai tidak sah", () => {
        expect(parseFilterTemuan({ modul: "x;drop", area: "-1", tingkat: "parah", dari: "17-11-2026" })).toEqual({
            modul: undefined,
            area: undefined,
            tingkat: undefined,
            dari: undefined,
            sampai: undefined,
            q: undefined,
        });
        expect(parseFilterTemuan({ modul: "mobil_pemadam", area: "3", tingkat: "berat" })).toMatchObject({
            modul: "mobil_pemadam",
            area: 3,
            tingkat: "berat",
        });
    });

    it("rekap: bulan berjalan bawaan; parameter laporan bulanan lama tetap diterima", () => {
        expect(filterRekap({}, "2026-11-17")).toMatchObject({ dari: "2026-11-01", sampai: "2026-11-30" });
        expect(filterRekap({ tipe: "apar", tahun: "2026", bulan: "2" }, "2026-11-17")).toMatchObject({
            modul: "apar",
            dari: "2026-02-01",
            sampai: "2026-02-28",
        });
        expect(namaBerkasRekap({ dari: "2026-11-01", sampai: "2026-11-30" })).toBe("Rekap-Temuan-2026-11.pdf");
        expect(namaBerkasRekap({ dari: "2026-11-03", sampai: "2026-11-09" })).toBe(
            "Rekap-Temuan-2026-11-03_2026-11-09.pdf",
        );
        expect(lingkupRekap({ dari: "2026-11-01", sampai: "2026-11-30", tingkat: "berat" }, "Bengkel Las")).toBe(
            "periode 1 November 2026 s.d. 30 November 2026 · Bengkel Las · tingkat berat",
        );
    });
});

describe("rekap temuan (PRD Laporan)", () => {
    it("berat dulu lalu terlama; tindakan berlabel; berulang ditandai; tanpa status atau tenggat", () => {
        const r = rakitRekapTemuan(
            [
                t({ id: 1 }),
                t({
                    id: 2,
                    asetId: 2,
                    severity: "berat",
                    tindakan: "ganti",
                    uraianTindakan: "unit cadangan",
                    berulang: 3,
                }),
                t({ id: 3, severity: "sedang", waktu: new Date("2026-11-01T02:00:00Z") }),
            ],
            10,
        );
        expect(r.baris.map((b) => [b.no, b.temuan.id])).toEqual([
            [1, 2],
            [2, 3],
            [3, 1],
        ]);
        expect(r.baris[0]).toMatchObject({ tindakan: "Ganti: unit cadangan", berulang: "Berulang (3 kali)" });
        expect(r.baris[2]!.berulang).toBeNull();
        expect(r.ringkas).toEqual({
            jumlah: 3,
            berat: 1,
            sedang: 1,
            ringan: 1,
            berulang: 1,
            unitTerdampak: 2,
            totalUnit: 10,
        });
        expect(Object.keys(r.baris[0]!)).not.toContain("status");
    });

    it("tanda tangan per unit pemilik", () => {
        expect(kolomTandaTangan(["SAT. PK"])).toEqual([
            ["Petugas Pemeriksa", "SAT. PK"],
            ["Kepala Unit", "SAT. PK"],
        ]);
        expect(kolomTandaTangan([])).toHaveLength(2);
    });
});

describe("progres lintas modul (PRD F14)", () => {
    const modul = [
        { slug: "apar", nama: "APAR", periode: "2026-11-01", jatuhTempo: "2026-11-30", mingguan: false },
        {
            slug: "mobil_pemadam",
            nama: "Mobil Pemadam",
            periode: "2026-11-16",
            jatuhTempo: "2026-11-22",
            mingguan: true,
        },
    ];
    const aset = [
        { id: 1, kode: "01D", modulSlug: "apar", modul: "APAR", area: "Gedung A", lokasi: "-" },
        { id: 2, kode: "02D", modulSlug: "apar", modul: "APAR", area: "Gedung A", lokasi: "-" },
        { id: 3, kode: "PMK-01", modulSlug: "mobil_pemadam", modul: "Mobil Pemadam", area: null, lokasi: "Pos" },
    ];

    it("per modul, per gedung, kondisi, dan aset yang belum dicek", () => {
        const p = rakitProgres(
            modul,
            aset,
            new Map([
                [1, { kesimpulan: "layak" as const }],
                [3, { kesimpulan: "tidak_layak" as const }],
            ]),
        );
        expect(p).toMatchObject({ total: 3, sudah: 2, belum: 1, persen: 66.7 });
        expect(p.perModul.map((m) => [m.slug, m.sudah, m.total])).toEqual([
            ["apar", 1, 2],
            ["mobil_pemadam", 1, 1],
        ]);
        expect(p.kondisi).toEqual({ layak: 1, layak_catatan: 0, tidak_layak: 1 });
        expect(p.perArea.map((a) => a.nama)).toEqual(["Gedung A", "Tanpa area (objek bergerak)"]);
        expect(p.perArea[0]!.belum.map((a) => a.kode)).toEqual(["02D"]);
    });
});
