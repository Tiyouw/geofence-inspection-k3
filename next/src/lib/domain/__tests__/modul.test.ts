import { describe, expect, it } from "vitest";
import { validasiDefinisiLangkah } from "../langkah-foto";
import { bangunTemuan, periksaKirim, usulanKesimpulan, type ButirChecklist } from "../inspeksi";
import { DEFINISI_HYDRANT_BOX, DEFINISI_HYDRANT_PILAR } from "../modul/hydrant";
import {
  DEFINISI_P3K,
  bacaTipeKotak,
  bakuIsi,
  kedaluwarsaTerdekat,
  kelengkapanP3k,
  konteksP3k,
  segeraKedaluwarsa,
  temuanIsiP3k,
  validasiIsi,
  type ButirIsiP3k,
  type JawabanIsiP3k,
} from "../modul/p3k";
import { periksaDefinisi, semuaButir } from "../modul/tipe";

const ctx = { tipeKotak: "A" as const, hariIni: "2026-11-17" };

/** Butir isi P3K seperti dibaca dari DB: id = urut. */
const isi: ButirIsiP3k[] = semuaButir(DEFINISI_P3K)
  .filter((b) => b.baku)
  .map((b) => ({ id: b.urut, label: b.label, jumlahBaku: b.baku!, hasExpiry: !!b.adaKedaluwarsa, satuan: b.satuan }));
const butir = (urut: number) => isi.find((b) => b.id === urut)!;

/** Isi lengkap untuk kotak A, tanggal kedaluwarsa jauh. */
function lengkap(): JawabanIsiP3k[] {
  return isi.map((b) => ({
    checklistItemId: b.id,
    nilaiAngka: bakuIsi(b, "A"),
    kondisiIsi: "aman",
    tglKedaluwarsaTerdekat: b.hasExpiry ? "2027-12-31" : null,
  }));
}
function ganti(j: JawabanIsiP3k[], urut: number, isian: Partial<JawabanIsiP3k>): JawabanIsiP3k[] {
  return j.map((x) => (x.checklistItemId === urut ? { ...x, ...isian } : x));
}

describe("definisi modul (PRD Checklist per modul)", () => {
  it.each([DEFINISI_P3K, DEFINISI_HYDRANT_BOX, DEFINISI_HYDRANT_PILAR])("$slug sah dan setiap butir punya langkah foto", (m) => {
    expect(periksaDefinisi(m)).toEqual([]);
  });

  it("P3K: 3 butir kotak + 21 isi, baku Lampiran II per tipe kotak", () => {
    const semua = semuaButir(DEFINISI_P3K);
    expect(semua).toHaveLength(24);
    expect(semua[3]).toMatchObject({ label: "Kasa steril terbungkus", baku: { A: 20, B: 40, C: 40 }, adaKedaluwarsa: true });
    expect(semua[8]).toMatchObject({ label: "Kapas (25 gram)", baku: { A: 1, B: 2, C: 3 } });
    expect(semua.filter((b) => b.adaKedaluwarsa).map((b) => b.urut)).toEqual([4, 7, 8, 13, 19, 20, 21]);
    expect(DEFINISI_P3K.langkahFoto.map((l) => l.kode)).toEqual(["kotak", "isi", "kedaluwarsa"]);
    expect(DEFINISI_P3K.pemilik.nama).toBe("Divisi Matra & K3LH");
  });

  it("hydrant: box 5 butir, pilar 4 butir, Baik/Rusak; siamese boleh Tidak ada", () => {
    expect(semuaButir(DEFINISI_HYDRANT_BOX).map((b) => b.severityMap!.Rusak)).toEqual(["sedang", "ringan", "berat", "sedang", "berat"]);
    const pilar = semuaButir(DEFINISI_HYDRANT_PILAR);
    expect(pilar).toHaveLength(4);
    expect(pilar[2]!.options).toEqual(["Baik", "Rusak", "Tidak ada"]);
    expect(DEFINISI_HYDRANT_BOX.pemilik.nama).toBe("SAT. PK");
  });

  it("periksaDefinisi menangkap butir tanpa langkah foto", () => {
    const rusak = { ...DEFINISI_HYDRANT_PILAR, langkahFoto: DEFINISI_HYDRANT_PILAR.langkahFoto.slice(0, 2) };
    expect(periksaDefinisi(rusak)).toEqual(["hydrant_pilar: butir 3 belum punya langkah foto."]);
  });
});

describe("hydrant: temuan dan kesimpulan lewat aturan umum", () => {
  const items: ButirChecklist[] = semuaButir(DEFINISI_HYDRANT_BOX).map((b) => ({
    id: b.urut,
    label: b.label,
    answerType: b.answerType,
    options: b.options ?? null,
    severityMap: b.severityMap ?? null,
    severityDefault: b.severityDefault,
    jumlahBaku: null,
    satuan: null,
    wajib: true,
  }));

  it("semua Baik → Layak pakai", () => {
    const t = bangunTemuan(items, items.map((i) => ({ checklistItemId: i.id, nilai: "Baik" })));
    expect(usulanKesimpulan(t)).toBe("layak");
  });

  it("selang Rusak → temuan berat → Tidak layak pakai; fisik box Rusak saja → dengan catatan", () => {
    const j = items.map((i) => ({ checklistItemId: i.id, nilai: i.id === 3 ? "Rusak" : "Baik" }));
    const t = bangunTemuan(items, j);
    expect(t).toEqual([{ checklistItemId: 3, item: "Selang kebakaran: Rusak", severity: "berat", tindakan: "ganti" }]);
    expect(usulanKesimpulan(t)).toBe("tidak_layak");
    const t2 = bangunTemuan(items, items.map((i) => ({ checklistItemId: i.id, nilai: i.id === 2 ? "Rusak" : "Baik" })));
    expect(usulanKesimpulan(t2)).toBe("layak_catatan");
  });
});

describe("P3K: isi kotak", () => {
  it("baku mengikuti tipe kotak; tipe dibaca dari atribut", () => {
    expect(bakuIsi(butir(4), "A")).toBe(20);
    expect(bakuIsi(butir(4), "B")).toBe(40);
    expect(bakuIsi({ jumlahBaku: 3 }, "C")).toBe(3);
    expect(bacaTipeKotak({ tipe_kotak: "b" })).toBe("B");
    expect(bacaTipeKotak({ tipe_kotak: "D" })).toBeNull();
    expect(bacaTipeKotak(null)).toBeNull();
  });

  it("isi lengkap: tanpa temuan, kelengkapan 100%", () => {
    expect(temuanIsiP3k(isi, lengkap(), ctx)).toEqual([]);
    expect(kelengkapanP3k(isi, lengkap(), ctx)).toEqual({ memenuhi: 21, total: 21, persen: 100 });
  });

  it("jumlah kurang → temuan sedang, tindakan Lengkapi", () => {
    const j = ganti(lengkap(), 8, { nilaiAngka: 6 });
    expect(temuanIsiP3k(isi, j, ctx)).toEqual([
      { checklistItemId: 8, item: "Plester cepat: 6 dari 10 buah, kurang 4", severity: "sedang", tindakan: "lengkapi" },
    ]);
    expect(kelengkapanP3k(isi, j, ctx)).toEqual({ memenuhi: 20, total: 21, persen: 95 });
  });

  it("jumlah 0 → temuan kosong; kondisi dan tanggal diabaikan", () => {
    const j = ganti(lengkap(), 11, { nilaiAngka: 0, kondisiIsi: null });
    expect(temuanIsiP3k(isi, j, ctx)[0]).toMatchObject({ item: "Gunting: kosong (baku 1 buah)", tindakan: "lengkapi" });
    expect(validasiIsi(butir(11), j.find((x) => x.checklistItemId === 11), ctx)).toBeNull();
  });

  it("ada yang kedaluwarsa → temuan sedang, tindakan Ganti", () => {
    const j = ganti(lengkap(), 20, { kondisiIsi: "kedaluwarsa", tglKedaluwarsaTerdekat: "2026-11-05" });
    expect(temuanIsiP3k(isi, j, ctx)).toEqual([
      {
        checklistItemId: 20,
        item: "Povidon iodin (60 ml): ada yang kedaluwarsa (terdekat 5 Nov 2026)",
        severity: "sedang",
        tindakan: "ganti",
      },
    ]);
  });

  it("kurang dan kedaluwarsa sekaligus → satu temuan per butir", () => {
    const j = ganti(lengkap(), 4, { nilaiAngka: 12, kondisiIsi: "kedaluwarsa", tglKedaluwarsaTerdekat: "2026-10-01" });
    const t = temuanIsiP3k(isi, j, ctx);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ item: "Kasa steril terbungkus: 12 dari 20 buah, kurang 8; ada yang kedaluwarsa (terdekat 1 Okt 2026)", tindakan: "lengkapi" });
  });

  it("kedaluwarsa ≤ 30 hari lagi → catatan, bukan temuan", () => {
    const j = ganti(lengkap(), 21, { tglKedaluwarsaTerdekat: "2026-12-17" });
    expect(temuanIsiP3k(isi, j, ctx)).toEqual([]);
    expect(segeraKedaluwarsa(isi, j, ctx)).toEqual([{ checklistItemId: 21, label: "Alkohol 70%", tanggal: "2026-12-17", sisaHari: 30 }]);
    expect(segeraKedaluwarsa(isi, ganti(lengkap(), 21, { tglKedaluwarsaTerdekat: "2026-12-18" }), ctx)).toEqual([]);
    expect(kedaluwarsaTerdekat(isi, j)).toEqual({ label: "Alkohol 70%", tanggal: "2026-12-17" });
  });

  it("validasi: jumlah wajib, kondisi wajib bila ada isi, tanggal wajib untuk isi bertanda bintang", () => {
    const b4 = butir(4);
    expect(validasiIsi(b4, undefined, ctx)).toBe('Jumlah "Kasa steril terbungkus" belum diisi.');
    expect(validasiIsi(b4, { checklistItemId: 4, nilaiAngka: 20 }, ctx)).toBe('Kondisi "Kasa steril terbungkus" belum dipilih.');
    expect(validasiIsi(b4, { checklistItemId: 4, nilaiAngka: 20, kondisiIsi: "aman" }, ctx)).toBe(
      'Tanggal kedaluwarsa terdekat "Kasa steril terbungkus" belum diisi.',
    );
    expect(validasiIsi(b4, { checklistItemId: 4, nilaiAngka: 20, kondisiIsi: "aman", tglKedaluwarsaTerdekat: "2026-11-16" }, ctx)).toMatch(
      /sudah lewat/,
    );
    expect(validasiIsi(butir(5), { checklistItemId: 5, nilaiAngka: 2, kondisiIsi: "aman", tglKedaluwarsaTerdekat: "2027-01-01" }, ctx)).toMatch(
      /tidak mencatat tanggal/,
    );
    expect(validasiIsi(b4, { checklistItemId: 4, nilaiAngka: -1 }, ctx)).toMatch(/tidak sah/);
  });

  it("kesimpulan: temuan isi (sedang) → Layak dengan catatan", () => {
    const t = temuanIsiP3k(isi, ganti(lengkap(), 8, { nilaiAngka: 6 }), ctx);
    expect(usulanKesimpulan(t)).toBe("layak_catatan");
  });
});

describe("P3K lewat aturan umum (bangunTemuan, periksaKirim)", () => {
  const items: ButirChecklist[] = semuaButir(DEFINISI_P3K).map((b) => ({
    id: b.urut,
    label: b.label,
    answerType: b.answerType,
    options: null,
    severityMap: null,
    severityDefault: b.severityDefault,
    jumlahBaku: null,
    satuan: b.satuan ?? null,
    wajib: true,
    jumlahBakuPerTipe: b.baku ?? null,
    hasExpiry: !!b.adaKedaluwarsa,
  }));
  const kotak = [1, 2, 3].map((id) => ({ checklistItemId: id, nilai: "ok" }));
  const dasar = { jumlahFoto: 3, kesimpulan: "layak" as const, rekomendasi: "" };

  it("isi kurang menjadi temuan hanya dengan konteks P3K, dan rekomendasi wajib", () => {
    const jawaban = [...kotak, ...ganti(lengkap(), 8, { nilaiAngka: 6 })];
    expect(bangunTemuan(items, jawaban)).toEqual([]);
    expect(bangunTemuan(items, jawaban, ctx)).toEqual([{ checklistItemId: 8, item: "Plester cepat: 6 dari 10 buah, kurang 4", severity: "sedang", tindakan: "lengkapi" }]);
    expect(periksaKirim(items, { ...dasar, jawaban, p3k: ctx }, 15)).toEqual(["Ada temuan pada inspeksi ini, rekomendasi wajib diisi."]);
  });

  it("validasi isi ikut diperiksa sebelum kirim", () => {
    const jawaban = [...kotak, ...ganti(lengkap(), 4, { kondisiIsi: null })];
    expect(periksaKirim(items, { ...dasar, jawaban, p3k: ctx }, 15)).toEqual(['Kondisi "Kasa steril terbungkus" belum dipilih.']);
    expect(periksaKirim(items, { ...dasar, jawaban: [...kotak, ...lengkap()], p3k: ctx }, 15)).toEqual([]);
  });

  it("konteksP3k hanya untuk tipe p3k; tipe kotak kosong dibaca A", () => {
    expect(konteksP3k("p3k", {}, "2026-11-17")).toEqual({ tipeKotak: "A", hariIni: "2026-11-17" });
    expect(konteksP3k("p3k", { tipe_kotak: "C" }, "2026-11-17")?.tipeKotak).toBe("C");
    expect(konteksP3k("apar", { tipe_kotak: "C" }, "2026-11-17")).toBeNull();
  });
});

describe("langkah foto sah menurut validator sesi C", () => {
  it.each([DEFINISI_P3K, DEFINISI_HYDRANT_BOX, DEFINISI_HYDRANT_PILAR])("$slug", (m) => {
    expect(validasiDefinisiLangkah(m.langkahFoto, semuaButir(m).map((b) => b.urut))).toEqual([]);
  });
});
