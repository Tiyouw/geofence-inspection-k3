/**
 * Data DEMO v2 (murni, tanpa basis data): denah KARANGAN, aset, dan skenario inspeksi.
 *
 * - Bukan denah perusahaan. Geometri dibuat dari kotak/bentuk L dalam meter di sekitar satu titik
 *   asal yang jauh dari galangan mana pun; seed membatalkan diri bila tumpang tindih dengan poligon
 *   non-demo (lihat demo.ts).
 * - Semua baris demo diberi penanda: kode area/aset berawalan `DEMO-`, akun demo tambahan pada
 *   daftar NIP tetap, entri jejak audit dengan `data.demo = true`. Reset hanya menghapus penanda ini.
 */
import type { AreaJenis, AssetTypeSlug, GateAlasan, HasilTinjauan, KodeDivisi } from "../../lib/domain/constants";
import type { GeometriArea, LngLat } from "../../lib/geo/geometri";

export const AWALAN_DEMO = "DEMO-";

/** Titik asal denah karangan (m timur, m utara diukur dari sini). */
export const ASAL_DEMO = { lat: -7.33, lng: 112.69 } as const;
const M = 111_195;

export function keLngLat(timur: number, utara: number): LngLat {
  const r = (n: number) => Math.round(n * 1e7) / 1e7;
  return [r(ASAL_DEMO.lng + timur / (M * Math.cos((ASAL_DEMO.lat * Math.PI) / 180))), r(ASAL_DEMO.lat + utara / M)];
}

function poligon(titik: [number, number][]): GeometriArea {
  const c = titik.map(([x, y]) => keLngLat(x, y));
  return { type: "Polygon", coordinates: [[...c, c[0]!]] };
}
const kotak = (x0: number, y0: number, x1: number, y1: number) => poligon([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);

export type AreaDemo = {
  kode: string;
  nama: string;
  jenis: AreaJenis;
  geometri: GeometriArea;
  /** false = hanya draf (belum disetujui). */
  disetujui: boolean;
  restricted?: boolean;
  unit?: KodeDivisi;
};

export const AREA_DEMO: AreaDemo[] = [
  { kode: "DEMO-KAWASAN", nama: "Kawasan Galangan Demo", jenis: "kawasan", geometri: kotak(0, 0, 600, 400), disetujui: true },
  { kode: "DEMO-KANTOR", nama: "Gedung Kantor Demo", jenis: "gedung", geometri: kotak(40, 280, 140, 360), disetujui: true, unit: "SATPK" },
  {
    kode: "DEMO-BENGKEL",
    nama: "Bengkel Fabrikasi Demo",
    jenis: "bengkel",
    geometri: poligon([[180, 220], [330, 220], [330, 260], [220, 260], [220, 360], [180, 360]]),
    disetujui: true,
    unit: "SATPK",
  },
  { kode: "DEMO-DOK", nama: "Dok Kering Demo", jenis: "dok", geometri: kotak(380, 200, 560, 300), disetujui: true },
  { kode: "DEMO-DERMAGA", nama: "Dermaga Demo", jenis: "dermaga", geometri: kotak(360, 20, 580, 60), disetujui: true },
  { kode: "DEMO-GUDANG-B3", nama: "Gudang B3 Demo", jenis: "gedung", geometri: kotak(40, 40, 120, 110), disetujui: true, restricted: true },
  { kode: "DEMO-KLINIK", nama: "Klinik Demo", jenis: "gedung", geometri: kotak(160, 60, 240, 120), disetujui: true, unit: "MATRA" },
  { kode: "DEMO-GEDUNG-BARU", nama: "Gedung Baru Demo (draf)", jenis: "gedung", geometri: kotak(260, 80, 330, 140), disetujui: false },
];

export type AsetDemo = {
  kode: string;
  tipe: AssetTypeSlug;
  /** null = belum berarea. */
  area: string | null;
  /** Titik dalam meter dari asal; null = belum ada koordinat. */
  titik: [number, number] | null;
  lantai: string;
  lokasiTeks: string;
  atribut: Record<string, unknown>;
};

export const ASET_DEMO: AsetDemo[] = [
  { kode: "DEMO-A01", tipe: "apar", area: "DEMO-KANTOR", titik: [60, 300], lantai: "Lt. 1", lokasiTeks: "Lobi utama", atribut: { tipe: "Powder", kapasitas_kg: 6 } },
  { kode: "DEMO-A02", tipe: "apar", area: "DEMO-KANTOR", titik: [120, 340], lantai: "Lt. 2", lokasiTeks: "Ruang rapat", atribut: { tipe: "CO2", kapasitas_kg: 5 } },
  { kode: "DEMO-A03", tipe: "apar", area: "DEMO-BENGKEL", titik: [200, 300], lantai: "-", lokasiTeks: "Dekat mesin las", atribut: { tipe: "Powder", kapasitas_kg: 9 } },
  { kode: "DEMO-A04", tipe: "apar", area: "DEMO-BENGKEL", titik: [300, 240], lantai: "-", lokasiTeks: "Pintu timur", atribut: { tipe: "Foam", kapasitas_kg: 9 } },
  { kode: "DEMO-A05", tipe: "apar", area: "DEMO-DOK", titik: [420, 250], lantai: "-", lokasiTeks: "Tangga dok", atribut: { tipe: "Powder", kapasitas_kg: 12 } },
  { kode: "DEMO-A06", tipe: "apar", area: "DEMO-DERMAGA", titik: [470, 40], lantai: "-", lokasiTeks: "Pos jaga dermaga", atribut: { tipe: "Powder", kapasitas_kg: 6 } },
  { kode: "DEMO-A07", tipe: "apar", area: "DEMO-GUDANG-B3", titik: [80, 75], lantai: "Lt. 1", lokasiTeks: "Rak bahan mudah terbakar", atribut: { tipe: "CO2", kapasitas_kg: 5 } },
  { kode: "DEMO-A08", tipe: "apar", area: null, titik: [300, 180], lantai: "-", lokasiTeks: "Lapangan tengah (belum berarea)", atribut: { tipe: "Powder", kapasitas_kg: 6 } },
  { kode: "DEMO-A09", tipe: "apar", area: null, titik: null, lantai: "-", lokasiTeks: "Gudang sementara (belum ada koordinat)", atribut: { tipe: "Powder", kapasitas_kg: 3 } },
  { kode: "DEMO-P01", tipe: "p3k", area: "DEMO-KLINIK", titik: [200, 90], lantai: "Lt. 1", lokasiTeks: "Ruang tunggu klinik", atribut: { tipe_kotak: "C" } },
  { kode: "DEMO-P02", tipe: "p3k", area: "DEMO-KANTOR", titik: [100, 320], lantai: "Lt. 1", lokasiTeks: "Pantri", atribut: { tipe_kotak: "B" } },
  { kode: "DEMO-P03", tipe: "p3k", area: "DEMO-BENGKEL", titik: [190, 240], lantai: "-", lokasiTeks: "Pos mandor bengkel", atribut: { tipe_kotak: "A" } },
  { kode: "DEMO-HP1", tipe: "hydrant_pilar", area: "DEMO-DOK", titik: [540, 280], lantai: "-", lokasiTeks: "Sudut timur laut dok", atribut: {} },
  { kode: "DEMO-HP2", tipe: "hydrant_pilar", area: "DEMO-DERMAGA", titik: [380, 30], lantai: "-", lokasiTeks: "Ujung barat dermaga", atribut: {} },
  { kode: "DEMO-HB1", tipe: "hydrant_box", area: "DEMO-KANTOR", titik: [50, 350], lantai: "Lt. 1", lokasiTeks: "Koridor barat", atribut: {} },
  { kode: "DEMO-HB2", tipe: "hydrant_box", area: "DEMO-BENGKEL", titik: [320, 250], lantai: "-", lokasiTeks: "Dinding selatan", atribut: {} },
  {
    kode: "DEMO-PMK",
    tipe: "mobil_pemadam",
    area: null,
    titik: [520, 120],
    lantai: "-",
    lokasiTeks: "Garasi pemadam (bergerak)",
    atribut: { nomor_lambung: "PMK-DEMO", nopol: "X 1234 DM", kapasitas_tangki_l: 5000, kapasitas_pompa_lpm: 2000 },
  },
];

/** Akun demo tambahan (di luar akun admin/pemantau/inspektur dari seed dasar). */
export const AKUN_DEMO: { nip: string; nama: string; role: "inspektur" | "pemantau"; unit: KodeDivisi }[] = [
  { nip: "inspektur.satpk", nama: "Inspektur SAT. PK (Demo)", role: "inspektur", unit: "SATPK" },
  { nip: "inspektur.matra", nama: "Inspektur Matra (Demo)", role: "inspektur", unit: "MATRA" },
  { nip: "pemantau.satpk", nama: "Pemantau SAT. PK (Demo)", role: "pemantau", unit: "SATPK" },
  { nip: "pemantau.matra", nama: "Pemantau Matra (Demo)", role: "pemantau", unit: "MATRA" },
];

/**
 * Skenario inspeksi. `bulanLalu` = periode sebelumnya (untuk laporan PDF bulan lalu).
 * `posisi` dalam meter dari asal (posisi inspektur), `akurasi` dalam meter.
 */
export type SkenarioDemo = {
  aset: string;
  /** Jam sebelum sekarang (bulan berjalan; dijepit ke awal bulan bila terlalu jauh). */
  jamLalu: number;
  /** Tanggal di bulan lalu (untuk laporan PDF bulan lalu); mengabaikan jamLalu. */
  bulanLalu?: number;
  /** draf + jejak audit inspeksi.ditolak_lokasi (jauh di luar kawasan). */
  ditolak?: boolean;
  gate: "sesuai" | "perlu_tinjauan" | "tidak_berlaku";
  alasan?: GateAlasan;
  posisi: [number, number];
  akurasi: number;
  /** Jumlah butir yang dijawab buruk (menjadi temuan). */
  buruk?: number;
  status_temuan?: "terbuka" | "proses" | "selesai";
  tinjauan?: { hasil: HasilTinjauan; oleh: "admin" | "pemantau.satpk" | "pemantau.matra"; catatan: string };
};

export const SKENARIO_DEMO: SkenarioDemo[] = [
  // Bulan berjalan: diterima
  { aset: "DEMO-A01", jamLalu: 30, gate: "sesuai", posisi: [62, 302], akurasi: 8 },
  { aset: "DEMO-A02", jamLalu: 28, gate: "sesuai", posisi: [118, 338], akurasi: 9, buruk: 1, status_temuan: "terbuka" },
  { aset: "DEMO-P01", jamLalu: 26, gate: "sesuai", posisi: [201, 91], akurasi: 7 },
  { aset: "DEMO-P02", jamLalu: 25, gate: "sesuai", posisi: [101, 321], akurasi: 10, buruk: 2, status_temuan: "proses" },
  { aset: "DEMO-HP1", jamLalu: 24, gate: "sesuai", posisi: [538, 279], akurasi: 6 },
  { aset: "DEMO-HB1", jamLalu: 23, gate: "sesuai", posisi: [52, 349], akurasi: 8, buruk: 1, status_temuan: "terbuka" },
  { aset: "DEMO-PMK", jamLalu: 22, gate: "tidak_berlaku", posisi: [515, 118], akurasi: 12 },
  { aset: "DEMO-PMK", jamLalu: 190, gate: "tidak_berlaku", posisi: [522, 121], akurasi: 15 },
  // Perlu tinjauan (antrean), tiap alasan
  { aset: "DEMO-A03", jamLalu: 6, gate: "perlu_tinjauan", alasan: "di_luar_gedung", posisi: [160, 300], akurasi: 10 },
  { aset: "DEMO-A04", jamLalu: 5, gate: "perlu_tinjauan", alasan: "gps_lemah", posisi: [298, 241], akurasi: 150 },
  { aset: "DEMO-P03", jamLalu: 4, gate: "perlu_tinjauan", alasan: "gps_lemah", posisi: [190, 242], akurasi: 120 },
  // Area terbatas: tanpa foto, masuk antrean
  { aset: "DEMO-A07", jamLalu: 3, gate: "sesuai", posisi: [81, 76], akurasi: 9 },
  // Sudah ditinjau
  {
    aset: "DEMO-A05",
    jamLalu: 20,
    gate: "perlu_tinjauan",
    alasan: "di_luar_gedung",
    posisi: [420, 330],
    akurasi: 9,
    tinjauan: { hasil: "diterima", oleh: "pemantau.satpk", catatan: "Petugas memeriksa dari tangga luar dok; foto sesuai." },
  },
  {
    aset: "DEMO-A06",
    jamLalu: 18,
    gate: "perlu_tinjauan",
    alasan: "gps_lemah",
    posisi: [470, 45],
    akurasi: 180,
    tinjauan: { hasil: "ditolak", oleh: "admin", catatan: "Foto tidak menunjukkan manometer. Ulangi inspeksi." },
  },
  // Ditolak gerbang: jauh di luar kawasan, tetap draf
  { aset: "DEMO-HB2", jamLalu: 2, ditolak: true, gate: "sesuai", posisi: [1500, 1400], akurasi: 10 },
  // Bulan lalu (laporan PDF)
  ...(["DEMO-A01", "DEMO-A02", "DEMO-A03", "DEMO-A04", "DEMO-A05", "DEMO-A06", "DEMO-P01", "DEMO-P02", "DEMO-HP1", "DEMO-HP2", "DEMO-HB1", "DEMO-HB2"] as const).map(
    (aset, i): SkenarioDemo => ({
      aset,
      jamLalu: 0,
      bulanLalu: 3 + i,
      gate: "sesuai",
      posisi: ASET_DEMO.find((a) => a.kode === aset)!.titik!,
      akurasi: 8,
      ...(i === 4 ? { buruk: 1, status_temuan: "selesai" as const } : {}),
    }),
  ),
];
