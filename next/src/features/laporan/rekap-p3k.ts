/**
 * Rekap isi P3K (PRD "Laporan"): per kotak, isi yang kurang dari baku, isi kedaluwarsa,
 * kedaluwarsa terdekat, dan kelengkapan %. Murni: data dari queries, PDF di pdf/rekap-p3k.tsx.
 * Satu baris per kotak aktif; kotak yang belum diperiksa pada periode tetap tercantum.
 */
import type { Kesimpulan } from "@/lib/domain/constants";
import {
  bakuIsi,
  kedaluwarsaTerdekat,
  kelengkapanP3k,
  nilaiIsi,
  segeraKedaluwarsa,
  type ButirIsiP3k,
  type JawabanIsiP3k,
  type Kelengkapan,
} from "@/lib/domain/modul/p3k";
import type { TipeKotak } from "@/lib/domain/modul/tipe";

export type KotakP3k = {
  id: number;
  kode: string;
  gedung: string | null;
  lantai: string | null;
  lokasiTeks: string;
  /** null bila atribut belum diisi: dinilai sebagai tipe A (kotak terkecil) {{Assumption}}. */
  tipeKotak: TipeKotak | null;
};

export type InspeksiP3k = {
  assetId: number;
  inspectedAt: Date;
  /** Tanggal inspeksi WIB "YYYY-MM-DD", acuan kedaluwarsa. */
  tanggal: string;
  kesimpulan: Kesimpulan | null;
  petugas: string;
  jawaban: JawabanIsiP3k[];
};

export type BarisRekapP3k = {
  no: number;
  kotak: KotakP3k;
  tipe: TipeKotak;
  inspeksi: InspeksiP3k | null;
  kelengkapan: Kelengkapan | null;
  kurang: { label: string; jumlah: number; baku: number }[];
  kedaluwarsa: { label: string; tanggal: string | null }[];
  segera: { label: string; tanggal: string; sisaHari: number }[];
  terdekat: { label: string; tanggal: string } | null;
};

export type RingkasRekapP3k = {
  total: number;
  diperiksa: number;
  /** Kotak dengan kelengkapan 100%. */
  lengkap: number;
  /** Rata-rata kelengkapan kotak yang diperiksa, dibulatkan ke bawah; null bila belum ada. */
  rataKelengkapan: number | null;
  isiKurang: number;
  isiKedaluwarsa: number;
  isiSegera: number;
};

const urutKotak = (a: KotakP3k, b: KotakP3k) =>
  (a.gedung ?? "").localeCompare(b.gedung ?? "", "id") || (a.lantai ?? "").localeCompare(b.lantai ?? "", "id") || a.kode.localeCompare(b.kode, "id", { numeric: true });

/** Inspeksi final terakhir per kotak dalam periode. */
function terakhir(inspeksi: InspeksiP3k[]): Map<number, InspeksiP3k> {
  const m = new Map<number, InspeksiP3k>();
  for (const i of inspeksi) {
    const ada = m.get(i.assetId);
    if (!ada || i.inspectedAt > ada.inspectedAt) m.set(i.assetId, i);
  }
  return m;
}

export function rakitRekapP3k(input: { kotak: KotakP3k[]; butir: ButirIsiP3k[]; inspeksi: InspeksiP3k[] }): {
  baris: BarisRekapP3k[];
  ringkas: RingkasRekapP3k;
} {
  const akhir = terakhir(input.inspeksi);
  const baris: BarisRekapP3k[] = [...input.kotak].sort(urutKotak).map((kotak, i) => {
    const tipe = kotak.tipeKotak ?? "A";
    const ins = akhir.get(kotak.id) ?? null;
    if (!ins) return { no: i + 1, kotak, tipe, inspeksi: null, kelengkapan: null, kurang: [], kedaluwarsa: [], segera: [], terdekat: null };
    const ctx = { tipeKotak: tipe, hariIni: ins.tanggal };
    const map = new Map(ins.jawaban.map((j) => [j.checklistItemId, j]));
    const kurang: BarisRekapP3k["kurang"] = [];
    const kedaluwarsa: BarisRekapP3k["kedaluwarsa"] = [];
    for (const b of input.butir) {
      const j = map.get(b.id);
      const n = nilaiIsi(b, j, ctx);
      if (n.jumlah !== null && n.kurang > 0) kurang.push({ label: b.label, jumlah: n.jumlah, baku: bakuIsi(b, tipe) ?? 0 });
      if (n.kedaluwarsa) kedaluwarsa.push({ label: b.label, tanggal: j?.tglKedaluwarsaTerdekat ?? null });
    }
    return {
      no: i + 1,
      kotak,
      tipe,
      inspeksi: ins,
      kelengkapan: kelengkapanP3k(input.butir, ins.jawaban, ctx),
      kurang,
      kedaluwarsa,
      segera: segeraKedaluwarsa(input.butir, ins.jawaban, ctx).map(({ label, tanggal, sisaHari }) => ({ label, tanggal, sisaHari })),
      terdekat: kedaluwarsaTerdekat(input.butir, ins.jawaban),
    };
  });

  const diperiksa = baris.filter((b) => b.kelengkapan);
  return {
    baris,
    ringkas: {
      total: baris.length,
      diperiksa: diperiksa.length,
      lengkap: diperiksa.filter((b) => b.kelengkapan!.persen === 100).length,
      rataKelengkapan: diperiksa.length ? Math.floor(diperiksa.reduce((n, b) => n + b.kelengkapan!.persen, 0) / diperiksa.length) : null,
      isiKurang: diperiksa.reduce((n, b) => n + b.kurang.length, 0),
      isiKedaluwarsa: diperiksa.reduce((n, b) => n + b.kedaluwarsa.length, 0),
      isiSegera: diperiksa.reduce((n, b) => n + b.segera.length, 0),
    },
  };
}
