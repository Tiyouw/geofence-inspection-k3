/**
 * Kamera terpandu (PRD "Aturan bukti" butir 3-4, ADR-8): urutan langkah foto per tipe aset.
 * Setiap langkah memetakan ke satu atau beberapa butir checklist, sehingga satu foto dapat
 * menjadi bukti beberapa butir. Aset di area terbatas tidak memerlukan foto.
 *
 * Bentuk definisi ini dipakai modul checklist (APAR, P3K, hydrant, mobil pemadam) dan
 * ditulis seed ke `photo_steps` / `photo_step_items`.
 */

/** Definisi langkah di modul checklist. Urutan larik = urutan langkah. */
export type DefinisiLangkahFoto = {
  /** Kunci stabil dalam satu tipe aset, mis. "manometer". */
  kode: string;
  /** Tampil besar sebagai "Foto sekarang: {judul}". */
  judul: string;
  petunjuk?: string;
  /** `checklist_items.urut` (urut global per tipe aset) yang dibuktikan langkah ini; minimal satu. */
  butir: number[];
};

/** Langkah yang sudah diselesaikan ke id butir: dipakai klien dan peladen. */
export type LangkahFoto = {
  kode: string;
  judul: string;
  petunjuk: string | null;
  itemIds: number[];
};

/** PRD "Aturan bukti" 3: maksimal 5 jepretan per langkah. */
export const MAKS_JEPRETAN_LANGKAH = 5;

/** Batas foto satu inspeksi mengikuti jumlah langkah. */
export function maksFotoInspeksi(langkah: LangkahFoto[]): number {
  return langkah.length * MAKS_JEPRETAN_LANGKAH;
}

/** APAR: lima langkah dari PRD "Aturan bukti" 3 (butir urut 1-10 Lampiran 03). */
export const LANGKAH_FOTO_APAR: DefinisiLangkahFoto[] = [
  { kode: "tabung", judul: "Tabung utuh dan label", petunjuk: "Seluruh tabung, handle, dan label petunjuk terlihat.", butir: [1, 4, 5, 6] },
  { kode: "manometer", judul: "Manometer", petunjuk: "Jarum dan zona warna terbaca jelas.", butir: [2] },
  { kode: "segel", judul: "Segel & pin", butir: [3] },
  { kode: "selang", judul: "Selang dan mulut pancar", butir: [7, 8] },
  { kode: "posisi", judul: "Posisi pasang dan kartu kontrol", petunjuk: "Mundur sedikit supaya ketinggian pasang dan kartu terlihat.", butir: [9, 10] },
];

/**
 * Validasi definisi terhadap butir aktif tipe aset. Setiap butir wajib terpetakan ke minimal
 * satu langkah (PRD "Aturan bukti" 3). Mengembalikan daftar pesan; kosong berarti sah.
 */
export function validasiDefinisiLangkah(def: DefinisiLangkahFoto[], urutButir: number[]): string[] {
  const galat: string[] = [];
  const ada = new Set(urutButir);
  const kode = new Set<string>();
  for (const l of def) {
    if (!l.kode.trim() || !l.judul.trim()) galat.push("Langkah foto wajib punya kode dan judul.");
    if (kode.has(l.kode)) galat.push(`Kode langkah "${l.kode}" ganda.`);
    kode.add(l.kode);
    if (l.butir.length === 0) galat.push(`Langkah "${l.judul}" belum memetakan butir.`);
    for (const u of l.butir) if (!ada.has(u)) galat.push(`Langkah "${l.judul}" merujuk butir ${u} yang tidak ada.`);
  }
  const terpetakan = new Set(def.flatMap((l) => l.butir));
  const lepas = urutButir.filter((u) => !terpetakan.has(u));
  if (lepas.length) galat.push(`Butir tanpa langkah foto: ${lepas.join(", ")}.`);
  return galat;
}

/** Selesaikan definisi ke id butir. Butir yang tidak aktif dilewati; langkah tanpa butir aktif dibuang. */
export function selesaikanLangkah(def: DefinisiLangkahFoto[], butir: { id: number; urut: number }[]): LangkahFoto[] {
  const idDariUrut = new Map(butir.map((b) => [b.urut, b.id]));
  return def
    .map((l) => ({
      kode: l.kode,
      judul: l.judul,
      petunjuk: l.petunjuk ?? null,
      itemIds: l.butir.map((u) => idDariUrut.get(u)).filter((x): x is number => x !== undefined),
    }))
    .filter((l) => l.itemIds.length > 0);
}

/**
 * Cadangan bila tipe aset belum punya langkah foto: satu langkah per grup checklist,
 * supaya setiap butir tetap punya bukti foto.
 */
export function langkahCadangan(grup: { kode: string | null; nama: string; items: { id: number }[] }[]): LangkahFoto[] {
  return grup
    .filter((g) => g.items.length > 0)
    .map((g, i) => ({ kode: `grup-${g.kode ?? i + 1}`, judul: g.nama, petunjuk: null, itemIds: g.items.map((x) => x.id) }));
}

/** Butir aktif yang tidak dibuktikan langkah mana pun. */
export function butirTanpaLangkah(langkah: LangkahFoto[], itemIds: number[]): number[] {
  const terpetakan = new Set(langkah.flatMap((l) => l.itemIds));
  return itemIds.filter((id) => !terpetakan.has(id));
}

/**
 * Syarat kirim foto (PRD "Aturan bukti" 3-4): setiap langkah minimal 1 jepretan, maksimal 5.
 * Aset di area terbatas tidak memerlukan foto dan tidak menerima foto.
 */
export function periksaFotoLangkah(
  langkah: LangkahFoto[],
  jepretan: { langkah: string }[],
  opts: { areaTerbatas: boolean },
): string[] {
  if (opts.areaTerbatas) {
    return jepretan.length ? ["Aset di area terbatas tidak boleh difoto. Hapus foto sebelum mengirim."] : [];
  }
  const galat: string[] = [];
  const hitung = new Map<string, number>();
  for (const j of jepretan) hitung.set(j.langkah, (hitung.get(j.langkah) ?? 0) + 1);
  const kenal = new Set(langkah.map((l) => l.kode));
  if ([...hitung.keys()].some((k) => !kenal.has(k))) galat.push("Ada foto untuk langkah yang tidak dikenal. Ulangi kamera terpandu.");
  const kosong = langkah.filter((l) => !hitung.get(l.kode)).map((l) => l.judul);
  if (kosong.length) galat.push(`Langkah foto yang belum diisi: ${kosong.join(", ")}`);
  for (const l of langkah) {
    if ((hitung.get(l.kode) ?? 0) > MAKS_JEPRETAN_LANGKAH) galat.push(`Langkah "${l.judul}" paling banyak ${MAKS_JEPRETAN_LANGKAH} foto.`);
  }
  return galat;
}

/** Tautan foto ke butir, diturunkan dari langkahnya: id butir → id foto (urut jepretan). */
export function fotoPerButir(langkah: LangkahFoto[], fotos: { photoId: string; langkah: string | null }[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const l of langkah) {
    const ids = fotos.filter((f) => f.langkah === l.kode).map((f) => f.photoId);
    for (const itemId of l.itemIds) out.set(itemId, [...(out.get(itemId) ?? []), ...ids]);
  }
  return out;
}

/**
 * Langkah sebuah tipe aset: dari definisi bila ada, selain itu cadangan per grup. Butir aktif
 * yang tidak terpetakan definisi dikumpulkan ke langkah "Butir lainnya", supaya tidak ada
 * butir tanpa bukti foto.
 */
export function langkahUntukTipe(
  def: DefinisiLangkahFoto[] | undefined,
  grup: { kode: string | null; nama: string; items: { id: number; urut: number }[] }[],
): LangkahFoto[] {
  if (!def?.length) return langkahCadangan(grup);
  const items = grup.flatMap((g) => g.items);
  const langkah = selesaikanLangkah(def, items);
  const lepas = butirTanpaLangkah(langkah, items.map((i) => i.id));
  if (lepas.length) langkah.push({ kode: "lainnya", judul: "Butir lainnya", petunjuk: null, itemIds: lepas });
  return langkah;
}
