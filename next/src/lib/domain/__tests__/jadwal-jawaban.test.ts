import { describe, expect, it } from "vitest";
import { hariDalamBulan, jatuhTempo, labelJadwal, periodeDari, sisaHari, statusSetelahInspeksi } from "../jadwal";
import { SIMBOL, severityJawaban, simbolJawaban, type ButirPenilaian } from "../jawaban";

describe("jadwal (SPEC §3.9)", () => {
  it("periode adalah tanggal 1 bulan itu", () => {
    expect(periodeDari("2026-10-17")).toBe("2026-10-01");
  });

  it("jatuh tempo = periode + periode_hari − 1, dibatasi akhir bulan (§9 #19)", () => {
    expect(jatuhTempo("2026-10-01", 30)).toBe("2026-10-30");
    expect(jatuhTempo("2026-11-01", 30)).toBe("2026-11-30");
    expect(jatuhTempo("2026-02-01", 30)).toBe("2026-02-28");
    expect(jatuhTempo("2028-02-01", 30)).toBe("2028-02-29");
    expect(jatuhTempo("2026-10-01", 7)).toBe("2026-10-07");
    expect(hariDalamBulan("2026-02-01")).toBe(28);
  });

  it("selesai bila ≤ akhir hari tenggat, telat setelahnya", () => {
    expect(statusSetelahInspeksi("2026-10-30", "2026-10-30")).toBe("selesai");
    expect(statusSetelahInspeksi("2026-10-31", "2026-10-30")).toBe("telat");
  });

  it("label Belum/Terlewat/Terlaksana/Terlaksana (telat)", () => {
    expect(labelJadwal("belum", "2026-10-30", "2026-10-30")).toBe("Belum");
    expect(labelJadwal("belum", "2026-10-30", "2026-10-31")).toBe("Terlewat");
    expect(labelJadwal("selesai", "2026-10-30", "2026-11-05")).toBe("Terlaksana");
    expect(labelJadwal("telat", "2026-10-30", "2026-11-05")).toBe("Terlaksana (telat)");
    expect(sisaHari("2026-10-28", "2026-10-30")).toBe(2);
    expect(sisaHari("2026-11-01", "2026-10-30")).toBe(-2);
  });
});

const volume: ButirPenilaian = { answerType: "select", severityMap: { "Tidak penuh": "berat" }, severityDefault: "berat" };
const handle: ButirPenilaian = { answerType: "boolean", severityDefault: "sedang" };
const fungsi: ButirPenilaian = { answerType: "fungsi", severityDefault: "berat" };
const kondisi: ButirPenilaian = { answerType: "kondisi" };
const kasa: ButirPenilaian = { answerType: "number", jumlahBaku: 40, severityDefault: "ringan" };

describe("severity jawaban (SPEC §3.4, ACCEPTANCE D6)", () => {
  it("select hanya pilihan yang terdaftar di severity_map", () => {
    expect(severityJawaban(volume, { nilai: "Tidak penuh" })).toBe("berat");
    expect(severityJawaban(volume, { nilai: "Penuh" })).toBeNull();
  });
  it("dua-nilai: 'tidak' memakai severity_default, 'ok' bukan temuan", () => {
    expect(severityJawaban(handle, { nilai: "tidak" })).toBe("sedang");
    expect(severityJawaban(kondisi, { nilai: "tidak" })).toBe("sedang");
    expect(severityJawaban(handle, { nilai: "ok" })).toBeNull();
  });
  it("angka di bawah baku menjadi temuan; tanpa baku tidak", () => {
    expect(severityJawaban(kasa, { nilaiAngka: 14 })).toBe("ringan");
    expect(severityJawaban(kasa, { nilaiAngka: 40 })).toBeNull();
    expect(severityJawaban({ answerType: "number" }, { nilaiAngka: 1 })).toBeNull();
  });
  it("teks dan tanggal tidak pernah menjadi temuan", () => {
    expect(severityJawaban({ answerType: "text" }, { nilai: "tidak" })).toBeNull();
    expect(severityJawaban({ answerType: "date" }, { nilai: "2026-01-01" })).toBeNull();
  });
});

describe("simbol PMS (SPEC §4.9, InspectionAnswerTest)", () => {
  it("empat simbol tidak saling tertukar", () => {
    const simbol = [
      simbolJawaban(fungsi, { nilai: "ok" }),
      simbolJawaban(fungsi, { nilai: "tidak" }),
      simbolJawaban(kondisi, { nilai: "ok" }),
      simbolJawaban(kondisi, { nilai: "tidak" }),
    ];
    expect(simbol).toEqual([SIMBOL.fungsiOk, SIMBOL.fungsiTidak, SIMBOL.kondisiOk, SIMBOL.kondisiTidak]);
    expect(new Set(simbol).size).toBe(4);
  });
  it("boolean memakai dimensi kondisi; select memakai severity_map", () => {
    expect(simbolJawaban(handle, { nilai: "tidak" })).toBe("Ø");
    expect(simbolJawaban(volume, { nilai: "Tidak penuh" })).toBe("Ø");
    expect(simbolJawaban(volume, { nilai: "Penuh" })).toBe("O");
  });
  it("angka dicetak apa adanya, tanpa jawaban '-'", () => {
    expect(simbolJawaban(kasa, { nilaiAngka: 14 })).toBe("14");
    expect(simbolJawaban(kasa, null)).toBe("-");
  });
});
