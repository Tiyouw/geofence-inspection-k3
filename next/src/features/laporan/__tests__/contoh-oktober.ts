/**
 * Data contoh yang meniru docs/v2/samples (Oktober 2026, dicetak 2 Nov 2026 09:00 WIB):
 * 35 APAR, 30 inspeksi final, 5 belum diperiksa, 3 tidak layak (volume tidak penuh),
 * 3 layak dengan catatan (label tidak ada), 4 inspeksi dengan status gerbang perlu_review.
 * Bukan data asli; tanpa token QR.
 */
import type { AsetLaporan, ButirLaporan, InspeksiLaporan, TemuanLaporan } from "../rakit";

export const DICETAK = new Date("2026-11-02T02:00:00Z"); // 09:00 WIB

const GRUP = ["Isi & Tekanan", "Kondisi Fisik", "Saluran Pancar", "Penempatan"];
export const BUTIR: ButirLaporan[] = [
  ["Volume isi tabung", 0, "select", "Permenaker 4/1980 Pasal 12(1)a"],
  ["Tekanan manometer", 0, "select", "Permenaker 4/1980 Pasal 12(1)a"],
  ["Segel dan mekanik penembus", 0, "boolean", "Permenaker 4/1980 Pasal 12(1)a"],
  ["Badan tabung", 1, "select", "Permenaker 4/1980 Pasal 12(1)b"],
  ["Handle dan tuas", 1, "boolean", "Permenaker 4/1980 Pasal 12(1)b"],
  ["Label dan petunjuk pakai", 1, "boolean", "Permenaker 4/1980 Pasal 12(1)b"],
  ["Mulut pancar tidak tersumbat", 2, "boolean", "Permenaker 4/1980 Pasal 12(1)c"],
  ["Pipa atau selang pancar tidak retak", 2, "boolean", "Permenaker 4/1980 Pasal 12(1)c"],
  ["Keterjangkauan dan ketinggian", 3, "boolean", "Permenaker 4/1980 Pasal 4-8 (tinggi 120 cm, jarak antar-APAR maks 15 m)"],
  ["Tanda pemasangan dan kartu kontrol", 3, "boolean", "Permenaker 4/1980 Pasal 4(1); NFPA 10"],
].map(([label, g, answerType, dasarHukum], i) => ({
  id: 100 + i,
  label: label as string,
  dasarHukum: dasarHukum as string,
  grupNama: GRUP[g as number]!,
  grupUrut: (g as number) + 1,
  urut: i + 1,
  answerType: answerType as ButirLaporan["answerType"],
  severityMap:
    i === 0
      ? { "Tidak penuh": "berat" }
      : i === 1
        ? { Kurang: "berat", Berlebih: "berat" }
        : i === 3
          ? { "Berkarat ringan": "ringan", "Berkarat berat": "sedang", Penyok: "sedang", "Harus diganti": "berat" }
          : null,
  severityDefault: (["berat", "berat", "sedang", "sedang", "sedang", "ringan", "berat", "sedang", "ringan", "ringan"] as const)[i]!,
  jumlahBaku: null,
}));

const lorong = (n: number) => (n <= 3 ? "Timur" : n <= 6 ? "Tengah" : "Barat");

/** Urutan sengaja diacak supaya pengurutan gedung, lantai, kode ikut diuji. */
export const ASET: AsetLaporan[] = [
  ...Array.from({ length: 24 }, (_, i) => {
    const lt = Math.floor(i / 8) + 1;
    const titik = (i % 8) + 1;
    return { kode: `${String(i + 1).padStart(2, "0")}D`, gedung: "Gedung PIP", lantai: `Lt. ${lt}`, lokasiTeks: `Lorong ${lorong(titik)} titik ${titik}` };
  }),
  ...["25D", "26C", "27D", "28C", "29D", "30C"].map((kode, i) => ({ kode, gedung: "Workshop", lantai: "Lt. 1", lokasiTeks: `Bay ${i + 1}` })),
  ...Array.from({ length: 5 }, (_, i) => ({ kode: `${31 + i}D`, gedung: "Area Terbuka", lantai: "-", lokasiTeks: `Pos ${i + 1}` })),
]
  .reverse()
  .map((a, i) => ({ ...a, id: i + 1, aktif: true }));

const BELUM = ["34D", "06D", "13D", "20D", "27D"];
const TIDAK_LAYAK = ["31D", "16D", "26C"];
const CATATAN = ["01D", "11D", "21D"];
const TINJAU = ["31D", "05D", "15D", "28C"];

/** Urutan PMS (gedung, lantai, kode) dipakai untuk tanggal dan petugas, seperti sampel. */
const urutPms = [...ASET].sort((a, b) => (a.gedung! + a.lantai + a.kode < b.gedung! + b.lantai + b.kode ? -1 : 1));

export const INSPEKSI: InspeksiLaporan[] = [];
export const TEMUAN: TemuanLaporan[] = [];

urutPms.forEach((a, idx) => {
  if (BELUM.includes(a.kode)) return;
  const hari = (idx % 27) + 1;
  const inspectedAt = new Date(Date.UTC(2026, 9, hari, 2, 0)); // 09:00 WIB
  const tidakLayak = TIDAK_LAYAK.includes(a.kode);
  const catatan = CATATAN.includes(a.kode);
  const id = `00000000-0000-4000-8000-${String(a.id).padStart(12, "0")}`;
  INSPEKSI.push({
    id,
    assetId: a.id,
    inspectedAt,
    kesimpulan: tidakLayak ? "tidak_layak" : catatan ? "layak_catatan" : "layak",
    gateStatus: TINJAU.includes(a.kode) ? "perlu_review" : "sesuai",
    ditinjauPada: null,
    petugas: idx % 2 === 0 ? "Inspektur Workshop" : "Inspektur Gedung PIP",
    jawaban: BUTIR.map((b) => ({
      checklistItemId: b.id,
      nilai:
        b.urut === 1 ? (tidakLayak ? "Tidak penuh" : "Penuh") : b.urut === 2 ? "Zona hijau" : b.urut === 4 ? "Mulus" : b.urut === 6 && catatan ? "tidak" : "ok",
      nilaiAngka: null,
    })),
  });
  if (tidakLayak || catatan) {
    const berat = tidakLayak;
    TEMUAN.push({
      id: TEMUAN.length + 1,
      assetId: a.id,
      item: berat ? "Volume isi tabung: Tidak penuh" : "Label dan petunjuk pakai: Tidak ada",
      severity: berat ? "berat" : "ringan",
      status: "terbuka",
      tindakLanjut: null,
      targetSelesai: new Date(inspectedAt.getTime() + (berat ? 3 : 30) * 86_400_000).toISOString().slice(0, 10),
      createdAt: inspectedAt,
      selesaiPada: null,
    });
  }
});

export const asetKode = (kode: string) => ASET.find((a) => a.kode === kode)!;
