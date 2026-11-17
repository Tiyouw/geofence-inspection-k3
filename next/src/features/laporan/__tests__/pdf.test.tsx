/**
 * Merender ketiga PDF dari data contoh Oktober 2026 (meniru docs/v2/samples).
 * Set PDF_KELUAR=/folder untuk menyimpan hasilnya dan membandingkannya dengan sampel.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { daftarkanFont } from "../pdf/dasar";
import { DokumenKartu } from "../pdf/kartu";
import { DokumenPms } from "../pdf/pms";
import { DokumenProgres } from "../pdf/progres";
import { DokumenRekap } from "../pdf/rekap";
import { barisLaporanProgres, rakitProgres } from "@/features/dasbor/rakit";
import { kolomTandaTangan, rakitRekapTemuan } from "@/features/temuan/rekap";
import { rakitKartu, rakitPeriode } from "../rakit";
import { ASET, BUTIR, DICETAK, INSPEKSI, TEMUAN, asetKode } from "./contoh-oktober";

daftarkanFont();
const data = {
  tipe: { slug: "apar", nama: "APAR" },
  filter: { tipe: "apar", tahun: 2026, bulan: 10, gedung: null },
  ...rakitPeriode({ aset: ASET, butir: BUTIR, inspeksi: INSPEKSI, temuan: TEMUAN }),
};

/** Teks PDF dikompresi; jumlah halaman cukup dibaca dari objek /Type /Page. */
const halaman = (b: Buffer) => (b.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

function simpan(nama: string, b: Buffer) {
  if (process.env.PDF_KELUAR) writeFileSync(join(process.env.PDF_KELUAR, nama), b);
}

describe("PDF laporan", { timeout: 60_000 }, () => {
  it("lembar PMS: tiga halaman seperti sampel", async () => {
    const b = await renderToBuffer(<DokumenPms data={data} dicetak={DICETAK} />);
    simpan("PMS-APAR-2026-10.pdf", b);
    expect(b.subarray(0, 5).toString()).toBe("%PDF-");
    expect(halaman(b)).toBe(3);
  });

  it("rekap temuan: satu halaman tanpa lampiran foto, satu halaman lagi dengan foto", async () => {
    const asetPer = new Map(ASET.map((a) => [a.id, a]));
    const rekap = rakitRekapTemuan(
      TEMUAN.map((t) => ({
        id: t.id,
        asetId: t.assetId,
        asetKode: asetPer.get(t.assetId)!.kode,
        modul: "APAR",
        lokasi: asetPer.get(t.assetId)!.lokasiTeks,
        item: t.item,
        severity: t.severity,
        tindakan: t.severity === "berat" ? "isi_ulang" : "lengkapi",
        uraianTindakan: null,
        waktu: t.createdAt,
        inspektur: "Inspektur Workshop",
        berulang: 1,
      })),
      ASET.length,
    );
    const isi = { judulModul: "APAR", lingkup: "periode 1 Oktober 2026 s.d. 31 Oktober 2026", rekap, tandaTangan: kolomTandaTangan(["SAT. PK"]) };
    const tanpa = await renderToBuffer(<DokumenRekap isi={isi} dicetak={DICETAK} foto={null} />);
    simpan("Rekap-Temuan-2026-10.pdf", tanpa);
    expect(halaman(tanpa)).toBe(1);

    // PNG 1x1 abu sebagai pengganti foto bukti.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNoAAAAggCBd81ytgAAAABJRU5ErkJggg==",
      "base64",
    );
    const foto = new Map([[rekap.baris[0]!.temuan.id, [{ data: png, format: "png" as const, diunggah: DICETAK }]]]);
    const dengan = await renderToBuffer(<DokumenRekap isi={isi} dicetak={DICETAK} foto={foto} />);
    simpan("Rekap-Temuan-2026-10-foto.pdf", dengan);
    expect(halaman(dengan)).toBe(2);
  });

  it("kartu kontrol: satu halaman", async () => {
    const a = asetKode("31D");
    const inspeksi = INSPEKSI.filter((i) => i.assetId === a.id).map((i) => ({ ...i, jumlahTemuan: 1 }));
    const kartu = {
      aset: { ...a, attributes: { tipe: "Dry Powder", kapasitas_kg: 9 }, tglExpired: null, tipe: "APAR", slug: "apar", divisi: "Gedung PIP" },
      inspeksi,
    };
    const b = await renderToBuffer(<DokumenKartu kartu={kartu} tahun={2026} baris={rakitKartu(2026, inspeksi, DICETAK)} dicetak={DICETAK} />);
    simpan("Kartu-Kontrol-31D-2026.pdf", b);
    expect(halaman(b)).toBe(1);
  });
  it("progres per gedung: satu halaman lanskap", async () => {
    const modul = [
      { slug: "apar", nama: "APAR", periode: "2026-10-01", jatuhTempo: "2026-10-31", mingguan: false },
      { slug: "mobil_pemadam", nama: "Mobil Pemadam", periode: "2026-10-05", jatuhTempo: "2026-11-01", mingguan: true },
    ];
    const aset = ASET.map((a) => ({ id: a.id, kode: a.kode, modulSlug: "apar", modul: "APAR", area: a.gedung, lokasi: a.lokasiTeks }));
    const cek = new Map(INSPEKSI.map((i) => [i.assetId as number | string, { kesimpulan: i.kesimpulan }]));
    const p = rakitProgres(modul, aset, cek);
    const data = { modul: p.perModul, unit: ["SAT. PK"], ...barisLaporanProgres(p, new Map([["Gedung PIP", { perluTinjauan: 2, ditolak: 1, temuan: 3 }]])) };
    const b = await renderToBuffer(
      <DokumenProgres
        isi={{ data, judulPeriode: "periode Oktober 2026", judulModul: "Semua modul", tandaTangan: kolomTandaTangan(["SAT. PK"]) }}
        dicetak={DICETAK}
      />,
    );
    simpan("Progres-Gedung-2026-10.pdf", b);
    expect(b.subarray(0, 5).toString()).toBe("%PDF-");
    expect(halaman(b)).toBeGreaterThanOrEqual(1);
  });
});
