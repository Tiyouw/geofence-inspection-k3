import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { DEFINISI_P3K, bakuIsi, type ButirIsiP3k, type JawabanIsiP3k } from "@/lib/domain/modul/p3k";
import { semuaButir } from "@/lib/domain/modul/tipe";
import { daftarkanFont } from "../pdf/dasar";
import { DokumenRekapP3k } from "../pdf/rekap-p3k";
import { rakitRekapP3k, type KotakP3k } from "../rekap-p3k";

const butir: ButirIsiP3k[] = semuaButir(DEFINISI_P3K)
  .filter((b) => b.baku)
  .map((b) => ({ id: b.urut, label: b.label, jumlahBaku: b.baku!, hasExpiry: !!b.adaKedaluwarsa, satuan: b.satuan }));

function isiLengkap(tipe: "A" | "B" | "C"): JawabanIsiP3k[] {
  return butir.map((b) => ({
    checklistItemId: b.id,
    nilaiAngka: bakuIsi(b, tipe),
    kondisiIsi: "aman",
    tglKedaluwarsaTerdekat: b.hasExpiry ? "2027-06-30" : null,
  }));
}

const kotak: KotakP3k[] = [
  { id: 2, kode: "P3K-02", gedung: "Bengkel B", lantai: "1", lokasiTeks: "Dinding barat", tipeKotak: "B" },
  { id: 1, kode: "P3K-01", gedung: "Bengkel A", lantai: "1", lokasiTeks: "Dekat pintu", tipeKotak: "A" },
  { id: 3, kode: "P3K-03", gedung: "Gudang", lantai: null, lokasiTeks: "Rak depan", tipeKotak: null },
];

const kotakB = isiLengkap("B").map((j) =>
  j.checklistItemId === 8
    ? { ...j, nilaiAngka: 9 }
    : j.checklistItemId === 20
      ? { ...j, kondisiIsi: "kedaluwarsa" as const, tglKedaluwarsaTerdekat: "2026-11-01" }
      : j.checklistItemId === 21
        ? { ...j, tglKedaluwarsaTerdekat: "2026-12-01" }
        : j,
);

const rekap = rakitRekapP3k({
  kotak,
  butir,
  inspeksi: [
    { assetId: 1, inspectedAt: new Date("2026-11-03T02:00:00Z"), tanggal: "2026-11-03", kesimpulan: "layak", petugas: "Inspektur Demo", jawaban: isiLengkap("A") },
    { assetId: 2, inspectedAt: new Date("2026-11-02T02:00:00Z"), tanggal: "2026-11-02", kesimpulan: "layak", petugas: "Inspektur Demo", jawaban: isiLengkap("B") },
    { assetId: 2, inspectedAt: new Date("2026-11-10T02:00:00Z"), tanggal: "2026-11-10", kesimpulan: "layak_catatan", petugas: "Inspektur Demo", jawaban: kotakB },
  ],
});

describe("rekap isi P3K", () => {
  it("urut gedung, inspeksi terakhir per kotak, kotak belum diperiksa tetap tercantum", () => {
    expect(rekap.baris.map((b) => b.kotak.kode)).toEqual(["P3K-01", "P3K-02", "P3K-03"]);
    const b = rekap.baris[1]!;
    expect(b.inspeksi?.tanggal).toBe("2026-11-10");
    expect(b.kurang).toEqual([{ label: "Plester cepat", jumlah: 9, baku: 15 }]);
    expect(b.kedaluwarsa).toEqual([{ label: "Povidon iodin (60 ml)", tanggal: "2026-11-01" }]);
    expect(b.segera).toEqual([{ label: "Alkohol 70%", tanggal: "2026-12-01", sisaHari: 21 }]);
    expect(b.terdekat).toEqual({ label: "Povidon iodin (60 ml)", tanggal: "2026-11-01" });
    expect(b.kelengkapan).toEqual({ memenuhi: 19, total: 21, persen: 90 });
    expect(rekap.baris[2]).toMatchObject({ tipe: "A", inspeksi: null, kelengkapan: null });
  });

  it("ringkasan", () => {
    expect(rekap.ringkas).toEqual({ total: 3, diperiksa: 2, lengkap: 1, rataKelengkapan: 95, isiKurang: 1, isiKedaluwarsa: 1, isiSegera: 1 });
  });

  it("PDF satu halaman", { timeout: 60_000 }, async () => {
    daftarkanFont();
    const b = await renderToBuffer(<DokumenRekapP3k rekap={rekap} judulPeriode="November 2026" gedung={null} dicetak={new Date("2026-11-17T03:00:00Z")} />);
    if (process.env.PDF_KELUAR) writeFileSync(join(process.env.PDF_KELUAR, "Rekap-Isi-P3K-2026-11.pdf"), b);
    expect(b.subarray(0, 5).toString()).toBe("%PDF-");
    expect((b.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
  });
});
