import { describe, expect, it } from "vitest";
import {
  butirTanpaLangkah,
  fotoPerButir,
  LANGKAH_FOTO_APAR,
  langkahCadangan,
  MAKS_JEPRETAN_LANGKAH,
  periksaFotoLangkah,
  selesaikanLangkah,
  validasiDefinisiLangkah,
  type LangkahFoto,
} from "../langkah-foto";

const langkah: LangkahFoto[] = [
  { kode: "tabung", judul: "Tabung utuh dan label", petunjuk: null, itemIds: [11, 14] },
  { kode: "manometer", judul: "Manometer", petunjuk: null, itemIds: [12] },
];

describe("validasiDefinisiLangkah (PRD Aturan bukti 3: setiap butir terpetakan)", () => {
  it("APAR memetakan kesepuluh butir", () => {
    expect(validasiDefinisiLangkah(LANGKAH_FOTO_APAR, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual([]);
  });

  it("menolak butir lepas, rujukan tak dikenal, langkah kosong, dan kode ganda", () => {
    const g = validasiDefinisiLangkah(
      [
        { kode: "a", judul: "A", butir: [1, 9] },
        { kode: "a", judul: "B", butir: [] },
      ],
      [1, 2],
    );
    expect(g).toEqual([
      'Langkah "A" merujuk butir 9 yang tidak ada.',
      'Kode langkah "a" ganda.',
      'Langkah "B" belum memetakan butir.',
      "Butir tanpa langkah foto: 2.",
    ]);
  });
});

describe("selesaikanLangkah dan cadangan", () => {
  it("menerjemahkan urut ke id dan membuang langkah tanpa butir aktif", () => {
    const hasil = selesaikanLangkah(
      [
        { kode: "x", judul: "X", butir: [1, 2] },
        { kode: "y", judul: "Y", petunjuk: "dekat", butir: [3] },
      ],
      [
        { id: 101, urut: 1 },
        { id: 102, urut: 2 },
      ],
    );
    expect(hasil).toEqual([{ kode: "x", judul: "X", petunjuk: null, itemIds: [101, 102] }]);
  });

  it("cadangan: satu langkah per grup, semua butir terbukti", () => {
    const c = langkahCadangan([
      { kode: "A", nama: "Isi & Tekanan", items: [{ id: 1 }, { id: 2 }] },
      { kode: null, nama: "Kosong", items: [] },
      { kode: "B", nama: "Fisik", items: [{ id: 3 }] },
    ]);
    expect(c.map((l) => l.kode)).toEqual(["grup-A", "grup-B"]);
    expect(butirTanpaLangkah(c, [1, 2, 3])).toEqual([]);
    expect(butirTanpaLangkah(langkah, [11, 12, 13])).toEqual([13]);
  });
});

describe("periksaFotoLangkah (PRD Aturan bukti 3-4)", () => {
  it("setiap langkah wajib minimal satu foto", () => {
    expect(periksaFotoLangkah(langkah, [{ langkah: "tabung" }], { areaTerbatas: false })).toEqual([
      "Langkah foto yang belum diisi: Manometer",
    ]);
    expect(periksaFotoLangkah(langkah, [{ langkah: "tabung" }, { langkah: "manometer" }], { areaTerbatas: false })).toEqual([]);
  });

  it("maksimal lima jepretan per langkah", () => {
    const banyak = Array.from({ length: MAKS_JEPRETAN_LANGKAH + 1 }, () => ({ langkah: "tabung" }));
    expect(periksaFotoLangkah(langkah, [...banyak, { langkah: "manometer" }], { areaTerbatas: false })).toEqual([
      'Langkah "Tabung utuh dan label" paling banyak 5 foto.',
    ]);
  });

  it("menolak foto untuk langkah yang tidak dikenal", () => {
    expect(
      periksaFotoLangkah(langkah, [{ langkah: "tabung" }, { langkah: "manometer" }, { langkah: "lain" }], { areaTerbatas: false }),
    ).toEqual(["Ada foto untuk langkah yang tidak dikenal. Ulangi kamera terpandu."]);
  });

  it("area terbatas: tanpa foto sah, dengan foto ditolak", () => {
    expect(periksaFotoLangkah(langkah, [], { areaTerbatas: true })).toEqual([]);
    expect(periksaFotoLangkah(langkah, [{ langkah: "tabung" }], { areaTerbatas: true })).toHaveLength(1);
  });
});

describe("fotoPerButir: satu foto untuk beberapa butir", () => {
  it("menurunkan tautan dari langkah", () => {
    const m = fotoPerButir(langkah, [
      { photoId: "p1", langkah: "tabung" },
      { photoId: "p2", langkah: "tabung" },
      { photoId: "p3", langkah: "manometer" },
    ]);
    expect(m.get(11)).toEqual(["p1", "p2"]);
    expect(m.get(14)).toEqual(["p1", "p2"]);
    expect(m.get(12)).toEqual(["p3"]);
  });
});
