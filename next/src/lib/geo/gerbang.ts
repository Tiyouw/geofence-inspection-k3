/**
 * Gerbang lokasi (PRD "Aturan gerbang lokasi", ADR-2, ADR-7). Fungsi murni: klien
 * memakainya untuk pratinjau sebelum kirim, peladen untuk keputusan resmi.
 *
 * Urutan aturan:
 *  1  aset bergerak (mobil pemadam)                      → diterima, tidak_berlaku
 *  2  tanpa posisi (lokasi mati / izin ditolak)           → diblokir
 *  2a akurasi > ambang lemah                              → diterima, perlu_tinjauan (gps_lemah)
 *  3  di dalam poligon area aset, atau jarak ≤ min(akurasi, toleransi gedung)
 *                                                          → diterima, sesuai
 *  4  di dalam poligon kawasan diperlebar toleransi kawasan
 *                                                          → diterima, perlu_tinjauan (di_luar_gedung)
 *  5  selain itu                                          → ditolak
 */
import { LABEL_GATE_ALASAN, type GateAlasan, type GateStatusV2 } from "@/lib/domain/constants";
import { type PengaturanGerbang, labelAkurasi, labelJarak, toleransiGedungEfektif } from "./akurasi";
import { type GeometriArea, type Titik, jarakKeAreaM, luasM2, titikDalamPoligon } from "./geometri";

export type StatusGerbang = GateStatusV2;
export type AlasanGerbang = GateAlasan;

export type HasilGerbangJenis = "diterima" | "ditolak" | "diblokir";

export type AreaGerbang = {
  id: number;
  nama: string;
  polygon: GeometriArea | null;
  restricted?: boolean;
};

export type MasukanGerbang = {
  /** null = lokasi mati atau izin ditolak. */
  posisi: (Titik & { akurasi: number }) | null;
  /** Area tempat aset terdaftar (gedung/bengkel/dok/dermaga). */
  areaAset: AreaGerbang | null;
  /** Poligon kawasan galangan. */
  kawasan: AreaGerbang | null;
  bergerak: boolean;
  pengaturan: PengaturanGerbang;
  /** Area lain (bukan kawasan) untuk mencatat area tempat posisi terdeteksi. */
  areaLain?: AreaGerbang[];
};

export type HasilGerbang = {
  hasil: HasilGerbangJenis;
  /** null bila ditolak atau diblokir (tidak menjadi inspeksi). */
  status: StatusGerbang | null;
  alasan: AlasanGerbang | null;
  /** Jarak ke tepi poligon area aset (0 bila di dalam); null bila tidak dapat dihitung. */
  jarakKeAreaM: number | null;
  /** Jarak ke tepi poligon kawasan (0 bila di dalam); null bila tidak dapat dihitung. */
  jarakKeKawasanM: number | null;
  /** Area terkecil (bukan kawasan) yang memuat posisi. */
  areaTerdeteksiId: number | null;
  /** Aset berada di area terbatas: inspeksi otomatis masuk antrean tinjauan. */
  areaTerbatas: boolean;
  akurasiM: number | null;
};

function areaTerdeteksi(p: Titik, daftar: AreaGerbang[] = []): number | null {
  let pilih: { id: number; luas: number } | null = null;
  for (const a of daftar) {
    if (!a.polygon || !titikDalamPoligon(p, a.polygon)) continue;
    const luas = luasM2(a.polygon);
    if (!pilih || luas < pilih.luas) pilih = { id: a.id, luas };
  }
  return pilih?.id ?? null;
}

const bulat = (n: number | null) => (n === null ? null : Math.round(n));

export function nilaiGerbang(m: MasukanGerbang): HasilGerbang {
  const areaTerbatas = Boolean(m.areaAset?.restricted);
  const dasar = {
    jarakKeAreaM: null,
    jarakKeKawasanM: null,
    areaTerdeteksiId: null,
    areaTerbatas,
    akurasiM: m.posisi?.akurasi ?? null,
  };

  // 1. Objek bergerak: tidak ada geofence.
  if (m.bergerak) return { ...dasar, hasil: "diterima", status: "tidak_berlaku", alasan: null, areaTerbatas: false };

  // 2. Tanpa posisi sama sekali: diblokir (ADR-7).
  if (!m.posisi || !Number.isFinite(m.posisi.lat) || !Number.isFinite(m.posisi.lng)) {
    return { ...dasar, akurasiM: null, hasil: "diblokir", status: null, alasan: null };
  }

  const p = m.posisi;
  const akurasi = Number.isFinite(p.akurasi) && p.akurasi >= 0 ? p.akurasi : Infinity;
  const jarakArea = m.areaAset?.polygon ? jarakKeAreaM(p, m.areaAset.polygon) : null;
  const jarakKawasan = m.kawasan?.polygon ? jarakKeAreaM(p, m.kawasan.polygon) : null;
  const terukur = {
    ...dasar,
    akurasiM: Number.isFinite(akurasi) ? akurasi : null,
    jarakKeAreaM: bulat(jarakArea),
    jarakKeKawasanM: bulat(jarakKawasan),
    areaTerdeteksiId: areaTerdeteksi(p, m.areaLain),
  };

  // 2a. Akurasi lemah: diterima untuk ditinjau, nilai akurasi disimpan.
  if (akurasi > m.pengaturan.akurasiLemahM) {
    return { ...terukur, hasil: "diterima", status: "perlu_tinjauan", alasan: "gps_lemah" };
  }

  // 3. Di dalam area aset, atau cukup dekat dengan tepinya.
  if (jarakArea !== null && jarakArea <= toleransiGedungEfektif(akurasi, m.pengaturan)) {
    return { ...terukur, hasil: "diterima", status: "sesuai", alasan: null };
  }

  // 4. Di dalam kawasan galangan (diperlebar). Tanpa poligon kawasan, gerbang tidak
  //    dapat menolak: kiriman diterima untuk ditinjau {{Assumption}}.
  if (jarakKawasan === null || jarakKawasan <= m.pengaturan.toleransiKawasanM) {
    return { ...terukur, hasil: "diterima", status: "perlu_tinjauan", alasan: "di_luar_gedung" };
  }

  // 5. Jauh di luar galangan.
  return { ...terukur, hasil: "ditolak", status: null, alasan: null };
}

/** Status yang masuk antrean tinjauan (Pemantau/Admin). */
export function perluDitinjau(h: Pick<HasilGerbang, "status" | "areaTerbatas">): boolean {
  return h.status === "perlu_tinjauan" || h.areaTerbatas;
}

/* ---------- pesan (PRD, Aturan gerbang lokasi; Copy and tone) ---------- */

export const PESAN_LOKASI_MATI =
  "Lokasi ponsel Anda mati atau izinnya ditolak. Nyalakan Lokasi (GPS) dan izinkan aplikasi memakainya, lalu tekan Coba lagi.";

export const LANGKAH_LOKASI_ANDROID = [
  "Tarik bilah notifikasi ke bawah, lalu nyalakan Lokasi.",
  "Di Chrome, ketuk ikon di kiri alamat situs, pilih Izin, lalu izinkan Lokasi.",
  "Kembali ke halaman ini dan tekan Coba lagi.",
] as const;

export function pesanSinyalLemah(akurasiM: number): string {
  return (
    `Sinyal GPS lemah (akurasi ${labelAkurasi(akurasiM)}). Ini biasa terjadi di dalam bengkel beratap baja, ` +
    "di dalam lambung kapal atau kamar mesin, di dekat dinding baja dan crane yang memantulkan sinyal, " +
    "saat mode hemat baterai aktif, atau ketika GPS baru dinyalakan. Coba melangkah ke dekat pintu atau " +
    "area terbuka dan tunggu beberapa detik. Inspeksi tetap dapat dikirim dan akan ditinjau."
  );
}

export function pesanDitolak(jarakKeKawasanM: number | null): string {
  const jarak = jarakKeKawasanM === null ? "" : ` (${labelJarak(jarakKeKawasanM)} dari batas)`;
  return `Posisi Anda berada di luar kawasan galangan${jarak}. Inspeksi tidak dapat dikirim. Kirim ulang dari lokasi aset.`;
}

export function pesanPerluTinjauan(namaGedung: string | null): string {
  return `Posisi Anda di luar ${namaGedung ?? "gedung aset"}. Inspeksi tetap terkirim dan akan ditinjau Admin K3 atau Pemantau.`;
}

export const LABEL_STATUS_GERBANG: Record<StatusGerbang, string> = {
  sesuai: "Lokasi sesuai",
  perlu_tinjauan: "Perlu tinjauan",
  tidak_berlaku: "Tidak berlaku (objek bergerak)",
};

export const LABEL_ALASAN_GERBANG = LABEL_GATE_ALASAN;
