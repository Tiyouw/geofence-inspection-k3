import { describe, expect, it } from "vitest";
import { batasPeta, halamanAman, parseTab, persen, titikPeta, type AsetPeta } from "./dasbor";
import { jatuhTempoPeriode, labelJadwal } from "./label";
import { escapeLike, halamanUntuk, polaMengandung, tindakanUntuk } from "./pencarian";
import { mundurBulan, parsePeriode, periodeDari, periodeJakarta, sisaHariBulan } from "./periode";
import { buatSandiAcak } from "./sandi";
import { galatKolom, skemaAset, skemaPengguna } from "./skema";
import { bagiLembar, parseDaftarKode, parseTata, TATA_LETAK, ukuranLabel, urlStiker } from "./stiker";

describe("periode WIB", () => {
    it("awal bulan Jakarta = 17.00 UTC hari sebelumnya", () => {
        const p = periodeDari(2026, 11);
        expect(p.awal.toISOString()).toBe("2026-10-31T17:00:00.000Z");
        expect(p.akhir.toISOString()).toBe("2026-11-30T17:00:00.000Z");
        expect(p.tanggal).toBe("2026-11-01");
    });

    it("31 Okt 23.30 WIB masih Oktober; 1 Nov 00.10 WIB sudah November", () => {
        expect(periodeJakarta(new Date("2026-10-31T16:30:00Z")).bulan).toBe(10);
        expect(periodeJakarta(new Date("2026-10-31T17:10:00Z")).bulan).toBe(11);
    });

    it("mundur melewati tahun dan menghitung sisa hari", () => {
        const p = mundurBulan(periodeDari(2026, 2), 3);
        expect([p.tahun, p.bulan]).toEqual([2025, 11]);
        expect(sisaHariBulan(new Date("2026-11-16T05:00:00Z"))).toBe(14);
    });

    it("parsePeriode menolak di luar 2020..2100", () => {
        expect(parsePeriode("2026-10")?.bulan).toBe(10);
        expect(parsePeriode("2019-01")).toBeNull();
        expect(parsePeriode("2026-13")).toBeNull();
        expect(parsePeriode("x")).toBeNull();
    });
});

describe("dasbor (I3, I4, I6)", () => {
    it("hanya tiga tab yang diterima (tenggat temuan dihapus, ADR-4)", () => {
        expect(parseTab(undefined)).toBe("berat");
        expect(parseTab("tinjauan")).toBe("tinjauan");
        expect(parseTab("lewat")).toBeNull();
        expect(parseTab("hapus")).toBeNull();
        expect(parseTab(["berat", "lewat"])).toBeNull();
    });

    it("halaman dikoreksi setelah entri terakhir diproses", () => {
        expect(halamanAman("3", 13, 6)).toEqual({ halaman: 3, terakhir: 3 });
        expect(halamanAman("3", 12, 6)).toEqual({ halaman: 2, terakhir: 2 });
        expect(halamanAman("abc", 0, 6)).toEqual({ halaman: 1, terakhir: 1 });
        expect(halamanAman("-2", 30, 6).halaman).toBe(1);
    });

    it("persen satu desimal dan aman untuk nol", () => {
        expect(persen(6, 7)).toBe(85.7);
        expect(persen(0, 0)).toBe(0);
    });

    const aset = (o: Partial<AsetPeta>): AsetPeta => ({
        id: 1,
        kode: "01D",
        gedung: "Gedung PIP",
        lantai: "1",
        lokasiTeks: "Lorong",
        lat: -7.2,
        lng: 112.7,
        sudahDiperiksa: false,
        tinjau: false,
        ...o,
    });

    it("aset tanpa koordinat dihitung tetapi tidak digambar; status dan tanda tinjau benar", () => {
        const { titik, tanpaTitik } = titikPeta([
            aset({ id: 1 }),
            aset({ id: 2, lat: null, lng: null }),
            aset({ id: 3, sudahDiperiksa: true, kesimpulan: "tidak_layak", tinjau: true }),
            aset({ id: 4, sudahDiperiksa: true, kesimpulan: null }),
        ]);
        expect(tanpaTitik).toBe(1);
        expect(titik.map((t) => [t.id, t.status, t.tinjau])).toEqual([
            [1, "belum", false],
            [3, "tidak_layak", true],
            [4, "tanpa_kesimpulan", false],
        ]);
        // Hanya kolom yang perlu; tidak ada token.
        expect(Object.keys(titik[0]!).sort()).toEqual([
            "area",
            "id",
            "kode",
            "lat",
            "lng",
            "lokasi",
            "status",
            "tinjau",
        ]);
    });

    it("satu titik atau titik berkoordinat sama tidak membagi dengan nol", () => {
        const b = batasPeta([
            { lat: 1, lng: 2 },
            { lat: 1, lng: 2 },
        ])!;
        expect(b[1][0] - b[0][0]).toBeGreaterThan(0);
        expect(b[1][1] - b[0][1]).toBeGreaterThan(0);
        expect(batasPeta([])).toBeNull();
        const semua = batasPeta([
            { lat: -7.3, lng: 112.7 },
            { lat: -7.2, lng: 112.8 },
        ])!;
        expect(semua).toEqual([
            [-7.3, 112.7],
            [-7.2, 112.8],
        ]);
    });
});

describe("label (H3, G10)", () => {
    it("label jadwal", () => {
        expect(labelJadwal("selesai", "2026-11-30", "2026-12-05").label).toBe("Terlaksana");
        expect(labelJadwal("telat", "2026-11-30", "2026-12-05").label).toBe("Terlaksana (telat)");
        expect(labelJadwal("belum", "2026-11-30", "2026-12-01").label).toBe("Terlewat");
        expect(labelJadwal("belum", "2026-11-30", "2026-11-30").label).toBe("Belum");
    });

    it("jatuh tempo APAR 30 hari dari tanggal 1", () => {
        expect(jatuhTempoPeriode("2026-11-01", 30)).toBe("2026-11-30");
        expect(jatuhTempoPeriode("2026-10-01", 30)).toBe("2026-10-30");
    });
});

describe("pencarian (K2, K4, K5)", () => {
    it("% dan _ diperlakukan sebagai huruf", () => {
        expect(escapeLike("50%_a!")).toBe("50!%!_a!!");
        expect(polaMengandung(" ab ")).toBe("%ab%");
    });

    it("pemantau tanpa halaman data induk dan tanpa tindakan", () => {
        const hrefs = halamanUntuk("pemantau").map((h) => h.href);
        expect(hrefs.every((h) => h.startsWith("/pemantau"))).toBe(true);
        expect(tindakanUntuk("pemantau")).toEqual([]);
        expect(tindakanUntuk("admin").map((t) => t.judul)).toContain("Tambah aset");
    });
});

describe("stiker (L7)", () => {
    it("tiga tata letak dengan ukuran mm tepat; bawaan 2x5", () => {
        expect(TATA_LETAK["3x8"]).toMatchObject({ kolom: 3, baris: 8, lebar: 63.5, tinggi: 33.9 });
        expect(TATA_LETAK["2x5"]).toMatchObject({ kolom: 2, baris: 5, lebar: 99.1, tinggi: 57 });
        expect(TATA_LETAK["2x4"]).toMatchObject({ kolom: 2, baris: 4, lebar: 99.1, tinggi: 67.7 });
        expect(parseTata(undefined)).toBe("2x5");
        expect(parseTata("9x9")).toBe("2x5");
        expect(ukuranLabel("3x8")).toEqual({ qrMm: 24, kodeMm: 3.8 });
        expect(ukuranLabel("2x5")).toEqual({ qrMm: 30, kodeMm: 4.6 });
    });

    it("kode dipisah koma, lembar dibagi, URL /i/{token}", () => {
        expect(parseDaftarKode(" 01D, 02A ,,")).toEqual(["01D", "02A"]);
        expect(bagiLembar([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        expect(urlStiker("https://x.test/", "PAL-K3-ab")).toBe("https://x.test/i/PAL-K3-ab");
    });
});

describe("skema masukan (H2, H8, H6, M3)", () => {
    const asetSah = { assetTypeId: "1", kode: "01D", lokasiTeks: "Lorong" };

    it("aset: lat/lng divalidasi dengan pesan Indonesia; area opsional", () => {
        expect(skemaAset.safeParse(asetSah).success).toBe(true);
        expect(skemaAset.parse({ ...asetSah, areaId: "4" }).areaId).toBe(4);
        expect(skemaAset.parse({ ...asetSah, areaId: "" }).areaId).toBeNull();
        const r = skemaAset.safeParse({ ...asetSah, lat: "95", lng: "200" });
        expect(r.success).toBe(false);
        const g = galatKolom(r.error!);
        expect(g.lat?.[0]).toBe("Lintang maksimal 90.");
        expect(g.lng?.[0]).toBe("Bujur maksimal 180.");
    });

    it("aset: lintang tanpa bujur ditolak; koma desimal dibaca; token tidak diterima", () => {
        expect(skemaAset.safeParse({ ...asetSah, lat: "-7,2" }).success).toBe(false);
        const ok = skemaAset.parse({ ...asetSah, lat: "-7,25", lng: "112,7", qrToken: "PAL-K3-x" });
        expect(ok.lat).toBe(-7.25);
        expect("qrToken" in ok).toBe(false);
    });

    it("pengguna: sandi kosong saat ubah = null; sandi pendek ditolak; NIP dikecilkan", () => {
        const dasar = { nip: " ABC123 ", name: "Budi", role: "inspektur" };
        expect(skemaPengguna.parse(dasar)).toMatchObject({ nip: "abc123", password: null, aktif: false });
        expect(galatKolom(skemaPengguna.safeParse({ ...dasar, password: "123" }).error!).password?.[0]).toBe(
            "Kata sandi minimal 8 karakter.",
        );
    });
});

describe("sandi acak (A11)", () => {
    it("14 karakter huruf/angka tanpa simbol, berbeda tiap kali", () => {
        const a = buatSandiAcak();
        expect(a).toMatch(/^[A-Za-z0-9]{14}$/);
        expect(buatSandiAcak()).not.toBe(a);
    });
});
