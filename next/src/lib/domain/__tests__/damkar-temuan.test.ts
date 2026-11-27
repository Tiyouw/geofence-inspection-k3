import { describe, expect, it } from "vitest";
import { bangunTemuan, validasiJawaban, type ButirChecklist } from "../inspeksi";
import {
    awalMinggu,
    jatuhTempoUntuk,
    periodeDalamBulan,
    periodeSebelum,
    periodeUntuk,
    rentangPeriode,
} from "../jadwal";
import { validasiDefinisiLangkah } from "../langkah-foto";
import { CHECKLIST_DAMKAR, LANGKAH_FOTO_DAMKAR, identitasDamkar } from "../modul/damkar";
import { hitungBerulang, lokasiTemuan } from "../temuan";

/** Butir mobil pemadam dalam bentuk ButirChecklist, id = urut. */
const butirDamkar: ButirChecklist[] = CHECKLIST_DAMKAR.flatMap((g) =>
    g.items.map((i) => ({
        id: i.urut,
        label: i.label,
        answerType: i.answerType,
        options: i.options ?? null,
        severityMap: i.severityMap ?? null,
        severityDefault: i.severityDefault,
        jumlahBaku: null,
        satuan: i.satuan ?? null,
        wajib: true,
        tindakanBawaan: i.tindakan,
    })),
);

describe("checklist mobil pemadam (PRD tab Mobil pemadam)", () => {
    it("17 butir dengan urut unik 1..17", () => {
        expect(butirDamkar.map((b) => b.id)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    });

    it("setiap butir masuk minimal satu langkah foto, dan langkah hanya merujuk butir yang ada", () => {
        const dipakai = new Set(LANGKAH_FOTO_DAMKAR.flatMap((l) => l.butir));
        expect([...dipakai].every((u) => u >= 1 && u <= 17)).toBe(true);
        expect(butirDamkar.filter((b) => !dipakai.has(b.id))).toEqual([]);
        expect(new Set(LANGKAH_FOTO_DAMKAR.map((l) => l.kode)).size).toBe(LANGKAH_FOTO_DAMKAR.length);
        expect(validasiDefinisiLangkah(LANGKAH_FOTO_DAMKAR, butirDamkar.map((b) => b.id))).toEqual([]);
    });

    it("semua lulus: tanpa temuan; odometer tidak pernah menjadi temuan", () => {
        const jawaban = butirDamkar.map((b) =>
            b.answerType === "number"
                ? { checklistItemId: b.id, nilaiAngka: 152_340 }
                : { checklistItemId: b.id, nilai: b.answerType === "select" ? "Ya" : "ok" },
        );
        expect(bangunTemuan(butirDamkar, jawaban)).toEqual([]);
    });

    it("odometer menerima angka besar (lebih dari 100.000 km)", () => {
        const odo = butirDamkar.find((b) => b.answerType === "number")!;
        expect(validasiJawaban(odo, { checklistItemId: odo.id, nilaiAngka: 152_340 })).toBeNull();
        expect(validasiJawaban(odo, { checklistItemId: odo.id, nilaiAngka: -1 })).not.toBeNull();
    });

    it("butir gagal menjadi temuan dengan tingkat dan tindakan dari definisi", () => {
        const temuan = bangunTemuan(butirDamkar, [
            { checklistItemId: 6, nilai: "tidak" }, // rem: berat, perbaiki
            { checklistItemId: 10, nilai: "Tidak" }, // tangki air: berat, isi ulang
            { checklistItemId: 16, nilai: "tidak" }, // penyimpanan: ringan
        ]);
        expect(temuan).toEqual([
            { checklistItemId: 6, item: "Rem berfungsi: Tidak baik", severity: "berat", tindakan: "perbaiki" },
            { checklistItemId: 10, item: "Tangki air penuh: Tidak", severity: "berat", tindakan: "isi_ulang" },
            {
                checklistItemId: 16,
                item: "Perlengkapan tersimpan aman dan mudah diambil: Tidak baik",
                severity: "ringan",
                tindakan: "perbaiki",
            },
        ]);
    });

    it("identitas kendaraan dari atribut", () => {
        expect(identitasDamkar({ nomor_lambung: "PMK-01", nopol: "L 1 X" })).toBe("PMK-01 · L 1 X");
        expect(identitasDamkar({})).toBeNull();
    });
});

describe("temuan sederhana (PRD Temuan)", () => {
    const items: ButirChecklist[] = [
        {
            id: 1,
            label: "Tabung",
            answerType: "kondisi",
            options: null,
            severityMap: null,
            severityDefault: "berat",
            jumlahBaku: null,
            satuan: null,
            wajib: true,
        },
        {
            id: 2,
            label: "Label",
            answerType: "kondisi",
            options: null,
            severityMap: null,
            severityDefault: "ringan",
            jumlahBaku: null,
            satuan: null,
            wajib: true,
        },
    ];

    it("tindakan bawaan menurut tingkat bila butir tidak menyebutnya", () => {
        const t = bangunTemuan(items, [
            { checklistItemId: 1, nilai: "tidak" },
            { checklistItemId: 2, nilai: "tidak" },
        ]);
        expect(t.map((x) => x.tindakan)).toEqual(["ganti", "perbaiki"]);
    });

    it("lokasi disalin sebagai teks: gedung, titik, lantai, identitas", () => {
        expect(lokasiTemuan({ gedung: "Gedung PIP", lantai: "1", lokasiTeks: "Lorong timur" })).toBe(
            "Gedung PIP · Lorong timur · Lt. 1",
        );
        expect(lokasiTemuan({ area: "Bengkel Las", gedung: "lama", lokasiTeks: "Pintu" })).toBe("Bengkel Las · Pintu");
        expect(lokasiTemuan({ lokasiTeks: "Pos pemadam", identitas: "PMK-01" })).toBe("Pos pemadam · PMK-01");
        expect(lokasiTemuan({})).toBe("-");
    });

    it("temuan berulang dihitung per aset dan butir", () => {
        const n = hitungBerulang([
            { assetId: 1, checklistItemId: 5 },
            { assetId: 1, checklistItemId: 5 },
            { assetId: 2, checklistItemId: 5 },
            { assetId: 1, checklistItemId: null },
        ]);
        expect(n.get("1:5")).toBe(2);
        expect(n.get("2:5")).toBe(1);
    });
});

describe("jadwal mingguan mobil pemadam (PRD F16)", () => {
    it("periode = Senin minggu itu; jatuh tempo = Minggu", () => {
        expect(awalMinggu("2026-11-17")).toBe("2026-11-16"); // Selasa → Senin
        expect(awalMinggu("2026-11-22")).toBe("2026-11-16"); // Minggu → Senin sebelumnya
        expect(awalMinggu("2026-11-16")).toBe("2026-11-16");
        expect(periodeUntuk("2026-11-17", 7)).toBe("2026-11-16");
        expect(jatuhTempoUntuk("2026-11-16", 7)).toBe("2026-11-22");
        expect(periodeUntuk("2026-12-31", 7)).toBe("2026-12-28");
        expect(jatuhTempoUntuk("2026-12-28", 7)).toBe("2027-01-03");
    });

    it("tipe bulanan tetap tanggal 1 dan aturan bulanan", () => {
        expect(periodeUntuk("2026-11-17", 30)).toBe("2026-11-01");
        expect(jatuhTempoUntuk("2026-11-01", 30)).toBe("2026-11-30");
        expect(periodeSebelum("2026-01-01", 30)).toBe("2025-12-01");
        expect(periodeSebelum("2026-11-16", 7)).toBe("2026-11-09");
    });

    it("rentang periode memakai batas hari WIB", () => {
        const m = rentangPeriode("2026-11-16", 7);
        expect(m.awal.toISOString()).toBe("2026-11-15T17:00:00.000Z");
        expect(m.akhir.toISOString()).toBe("2026-11-22T17:00:00.000Z");
        const b = rentangPeriode("2026-12-01", 30);
        expect(b.akhir.toISOString()).toBe("2026-12-31T17:00:00.000Z");
    });

    it("periode yang dimulai di sebuah bulan", () => {
        expect(periodeDalamBulan("2026-11-01", 7)).toEqual([
            "2026-11-02",
            "2026-11-09",
            "2026-11-16",
            "2026-11-23",
            "2026-11-30",
        ]);
        expect(periodeDalamBulan("2026-06-01", 7)[0]).toBe("2026-06-01");
        expect(periodeDalamBulan("2026-11-01", 30)).toEqual(["2026-11-01"]);
    });
});
