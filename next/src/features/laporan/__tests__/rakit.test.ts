import { describe, expect, it } from "vitest";
import { namaPeriode, persen1, tglDm, tglDmy2, tglPanjang, tglSingkat, waktuCetak } from "../format";
import {
  labelMedia,
  narasiPemantau,
  rakitKartu,
  rakitPeriode,
  rakitRekap,
  sisaHariBulan,
  urutRisiko,
  type AngkaPantau,
  type TemuanLaporan,
} from "../rakit";
import { ASET, BUTIR, DICETAK, INSPEKSI, TEMUAN, asetKode } from "./contoh-oktober";

const data = rakitPeriode({ aset: ASET, butir: BUTIR, inspeksi: INSPEKSI, temuan: TEMUAN });

describe("lembar PMS (SPEC §4.9, ACCEPTANCE L1-L2)", () => {
  it("ringkasan sama dengan samples/contoh-pms-apar-2026-10.pdf", () => {
    expect(data.ringkas).toEqual({
      total: 35,
      diperiksa: 30,
      belum: 5,
      kepatuhan: 85.7,
      layak: 24,
      layakCatatan: 3,
      tidakLayak: 3,
      beratTerbuka: 3,
      perluTinjauan: 4,
    });
    expect(persen1(data.ringkas.kepatuhan)).toBe("85,7");
  });

  it("urut gedung, lantai, kode; kelompok butir per grup", () => {
    expect(data.baris.slice(0, 6).map((b) => b.aset.kode)).toEqual(["31D", "32D", "33D", "34D", "35D", "01D"]);
    expect(data.baris.at(-1)!.aset.kode).toBe("30C");
    expect(data.grup).toEqual([
      { nama: "Isi & Tekanan", jumlah: 3 },
      { nama: "Kondisi Fisik", jumlah: 3 },
      { nama: "Saluran Pancar", jumlah: 2 },
      { nama: "Penempatan", jumlah: 2 },
    ]);
  });

  it("sel simbol, baris kosong, dan lokasi dengan lantai", () => {
    const pertama = data.baris[0]!;
    expect(pertama.simbol).toEqual(["Ø", "O", "O", "O", "O", "O", "O", "O", "O", "O"]);
    expect(pertama.kesimpulan).toBe("Tidak layak pakai");
    expect(pertama.lokasi).toEqual({ utama: "Pos 1", lantai: null });
    const kosong = data.baris.find((b) => b.aset.kode === "34D")!;
    expect(kosong.inspeksi).toBeNull();
    expect(kosong.simbol.every((s) => s === "-")).toBe(true);
    expect(kosong.kesimpulan).toBe("Belum diperiksa");
    const catatan = data.baris.find((b) => b.aset.kode === "01D")!;
    expect(catatan.simbol[5]).toBe("Ø");
    expect(catatan.lokasi).toEqual({ utama: "Lorong Timur titik 1", lantai: "Lt. 1" });
    expect(tglDm(catatan.inspeksi!.inspectedAt)).toBe("06/10");
  });

  it("satu inspeksi per aset: yang terakhir dalam periode (L2)", () => {
    const a = asetKode("32D");
    const awal = INSPEKSI.find((i) => i.assetId === a.id)!;
    const ulang = { ...awal, id: "ulang", inspectedAt: new Date("2026-10-28T03:00:00Z"), kesimpulan: "tidak_layak" as const };
    const d = rakitPeriode({ aset: ASET, butir: BUTIR, inspeksi: [ulang, ...INSPEKSI], temuan: [] });
    expect(d.ringkas.diperiksa).toBe(30);
    expect(d.baris.find((b) => b.aset.kode === "32D")!.inspeksi!.id).toBe("ulang");
  });

  it("perlu tinjauan = definisi antrean: tanpa_gps ikut, yang sudah ditinjau tidak (§9 #8)", () => {
    const [x, y, ...sisa] = INSPEKSI;
    const d = rakitPeriode({
      aset: ASET,
      butir: BUTIR,
      inspeksi: [{ ...x!, gateStatus: "tanpa_gps" }, { ...y!, gateStatus: "jauh", ditinjauPada: new Date() }, ...sisa],
      temuan: [],
    });
    const asli = [x!, y!].filter((i) => i.gateStatus === "perlu_review").length;
    expect(d.ringkas.perluTinjauan).toBe(4 - asli + 1);
  });

  it("aset nonaktif tetap muncul bila diinspeksi pada periode itu (§9 #9)", () => {
    const aset = ASET.map((a) => (a.kode === "32D" || a.kode === "34D" ? { ...a, aktif: false } : a));
    const d = rakitPeriode({ aset, butir: BUTIR, inspeksi: INSPEKSI, temuan: TEMUAN });
    const kode = d.baris.map((b) => b.aset.kode);
    expect(kode).toContain("32D");
    expect(kode).not.toContain("34D");
    expect(d.ringkas.total).toBe(34);
  });
});

describe("rekap temuan (ACCEPTANCE L4)", () => {
  const rekap = rakitRekap(data, DICETAK);

  it("ringkasan dan urutan sama dengan samples/contoh-rekap-temuan-2026-10.pdf", () => {
    expect(rekap.ringkas).toEqual({ terbuka: 6, berat: 3, lewat: 3, unitTerdampak: 6, totalUnit: 35 });
    expect(rekap.baris.map((b) => b.aset!.kode)).toEqual(["31D", "26C", "16D", "01D", "11D", "21D"]);
  });

  it("tindakan baku bila tindak lanjut kosong, umur, dan tanda lewat", () => {
    const [satu, , , empat] = rekap.baris;
    expect(satu!.tindakan).toBe("Tabung diturunkan dari layanan, diganti unit cadangan");
    expect(satu!.lewat).toBe(true);
    expect(satu!.umur).toBe(32);
    expect(tglDmy2(satu!.temuan.targetSelesai!)).toBe("04/10/26");
    expect(tglSingkat(satu!.temuan.createdAt)).toBe("01 Okt 2026");
    expect(empat!.tindakan).toBe("Dibenahi pada kunjungan berikutnya");
    expect(empat!.lewat).toBe(false);
    expect(empat!.lokasi).toEqual({ utama: "Lorong Timur titik 1", lantai: "Lt. 1" });
  });

  it("tenggat hari ini belum dihitung lewat; temuan selesai tidak masuk", () => {
    const t = { ...TEMUAN[0]!, targetSelesai: "2026-11-02" };
    const selesai = { ...TEMUAN[1]!, status: "selesai" as const };
    const r = rakitRekap(rakitPeriode({ aset: ASET, butir: BUTIR, inspeksi: [], temuan: [t, selesai] }), DICETAK);
    expect(r.baris).toHaveLength(1);
    expect(r.baris[0]!.lewat).toBe(false);
  });
});

describe("kartu kontrol (ACCEPTANCE L5)", () => {
  const a = asetKode("31D");
  const ins = INSPEKSI.filter((i) => i.assetId === a.id).map((i) => ({ ...i, jumlahTemuan: 1 }));
  const kartu = rakitKartu(2026, ins, DICETAK);

  it("12 baris bulan: terlewat, isi, mendatang (samples/contoh-kartu-kontrol.pdf)", () => {
    expect(kartu).toHaveLength(12);
    expect(kartu.slice(0, 9).every((b) => b.keadaan === "terlewat")).toBe(true);
    expect(kartu[9]).toMatchObject({ bulan: "Oktober", keadaan: "isi", tinjau: true });
    expect(tglDm(kartu[9]!.inspeksi!.inspectedAt)).toBe("01/10");
    expect(kartu[10]!.keadaan).toBe("mendatang");
    expect(kartu[11]!.keadaan).toBe("mendatang");
  });

  it("pemeriksaan ulang sebulan: yang terakhir; tahun lain diabaikan", () => {
    const k = rakitKartu(
      2026,
      [
        { ...ins[0]!, inspectedAt: new Date("2026-10-20T02:00:00Z"), petugas: "Ulang" },
        { ...ins[0]!, inspectedAt: new Date("2025-10-20T02:00:00Z"), petugas: "Lama" },
        ins[0]!,
      ],
      DICETAK,
    );
    expect(k[9]!.inspeksi!.petugas).toBe("Ulang");
  });

  it("label media", () => {
    expect(labelMedia({ tipe: "Dry Powder", kapasitas_kg: 9 })).toBe("Dry Powder / 9 kg");
    expect(labelMedia({ kapasitas_kg: 4.5 })).toBe("APAR / 4.5 kg");
    expect(labelMedia(null)).toBeNull();
  });
});

describe("ringkasan pemantau (ACCEPTANCE J2-J3)", () => {
  const dasar: AngkaPantau = { total: 35, diperiksa: 30, persen: 85.7, tidakLayak: 3, berat: 3, lewat: 3, posisi: 4, hari: 14 };

  it("narasi tiga keadaan", () => {
    expect(narasiPemantau({ ...dasar, total: 0 }, persen1)).toBe(
      "Belum ada APAR aktif. Ringkasan akan terisi setelah aset dan inspeksi tersedia.",
    );
    expect(narasiPemantau({ ...dasar, diperiksa: 0 }, persen1)).toBe(
      "Belum ada inspeksi bulan ini. 35 APAR aktif menunggu pemeriksaan sebelum akhir bulan (sisa 14 hari).",
    );
    expect(narasiPemantau(dasar, persen1)).toBe(
      "30 dari 35 APAR sudah diperiksa bulan ini (85,7%). 3 unit dinyatakan tidak layak pakai. " +
        "Ada 3 temuan berat dan 3 temuan lewat tenggat yang belum selesai, serta 4 inspeksi yang menunggu tinjauan posisi.",
    );
  });

  it("risiko: 5 teratas, berat dulu, tenggat terdekat, tanpa tenggat terakhir", () => {
    const t = (id: number, severity: TemuanLaporan["severity"], targetSelesai: string | null, status: TemuanLaporan["status"] = "terbuka") => ({
      id,
      severity,
      targetSelesai,
      status,
    });
    const r = urutRisiko(
      [
        t(1, "ringan", null),
        t(2, "sedang", "2026-11-20"),
        t(3, "berat", null),
        t(4, "berat", "2026-11-01"),
        t(5, "ringan", "2026-10-30"),
        t(6, "berat", "2026-11-05", "selesai"),
        t(7, "sedang", "2026-11-03"),
      ],
      "2026-11-02",
    );
    expect(r.map((x) => x.id)).toEqual([4, 3, 5, 7, 2]);
    expect(r[0]!.tanda).toEqual(["Berat", "Lewat tenggat"]);
    expect(r[1]!.tanda).toEqual(["Berat"]);
    expect(r[2]!.tanda).toEqual(["Lewat tenggat"]);
    expect(r[3]!.tanda).toEqual(["Perlu perhatian"]);
  });

  it("sisa hari bulan ini", () => {
    expect(sisaHariBulan(new Date("2026-11-30T10:00:00Z"))).toBe(1);
    expect(sisaHariBulan(new Date("2026-11-16T02:00:00Z"))).toBe(15);
  });
});

describe("format laporan (ACCEPTANCE L8)", () => {
  it("bentuk tanggal dan angka Indonesia", () => {
    expect(waktuCetak(DICETAK)).toBe("02 Nov 2026 09:00");
    expect(tglPanjang(DICETAK)).toBe("02 November 2026");
    expect(tglSingkat("2026-08-05")).toBe("05 Agt 2026");
    expect(namaPeriode(2026, 10)).toBe("Oktober 2026");
    expect(persen1(100)).toBe("100,0");
    expect(persen1(1234.56)).toBe("1.234,6");
  });
});
