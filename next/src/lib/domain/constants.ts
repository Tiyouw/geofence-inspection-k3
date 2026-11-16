/**
 * Nilai domain bersama: dipakai skema basis data, validasi, dan antarmuka.
 * Disimpan sebagai teks di basis data (bukan enum Postgres), mengikuti keputusan
 * aplikasi Laravel yang mengubah enum menjadi string supaya mudah diperluas.
 */

export const ROLES = ["admin", "pemantau", "inspektur"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator K3",
  pemantau: "Pemantau",
  inspektur: "Inspektur",
};

/** Halaman awal tiap peran setelah masuk. */
export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  pemantau: "/pemantau",
  inspektur: "/petugas",
};

export const SEVERITIES = ["ringan", "sedang", "berat"] as const;
export type Severity = (typeof SEVERITIES)[number];

/**
 * fungsi  = centang/silang (dioperasikan)
 * kondisi = O / O-bergaris (dilihat saja)
 * boolean = baik/tidak baik
 * select  = pilihan dari `options`, keparahan lewat `severity_map`
 * number  = angka, dibandingkan dengan `jumlah_baku` (kotak P3K)
 * date    = tanggal (mis. tanggal kedaluwarsa)
 * text    = catatan bebas
 */
export const ANSWER_TYPES = ["fungsi", "kondisi", "boolean", "select", "number", "date", "text"] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];

export const LOKASI_TIPE = ["dalam_gedung", "bengkel", "area_terbuka", "kendaraan"] as const;
export type LokasiTipe = (typeof LOKASI_TIPE)[number];

/** Bagian 5.5: radius gerbang GPS per jenis lokasi. null = tidak diberlakukan. */
export const RADIUS_PER_LOKASI: Record<LokasiTipe, number | null> = {
  dalam_gedung: 75,
  bengkel: 60,
  area_terbuka: 30,
  kendaraan: null,
};

export const LABEL_LOKASI: Record<LokasiTipe, string> = {
  dalam_gedung: "Dalam gedung bertingkat",
  bengkel: "Bengkel atau gudang",
  area_terbuka: "Area terbuka",
  kendaraan: "Kendaraan (bergerak)",
};

export const RADIUS_BAWAAN_M = 75;
/** Bagian 5.6: di atas ambang ini GPS dianggap tidak bisa dipercaya, bukan pelanggaran. */
export const AKURASI_LEMAH_M = 100;
/** Pengisian checklist lebih cepat dari ini ditandai tak wajar. */
export const DURASI_WAJAR_DETIK = 45;

export const GATE_STATUSES = [
  "sesuai",
  "perlu_review",
  "jauh",
  "gps_lemah",
  "tanpa_gps",
  "tidak_berlaku",
] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];
/** Status gerbang yang masuk antrean tinjauan admin. */
export const GATE_PERLU_TINJAUAN: GateStatus[] = ["perlu_review", "jauh", "gps_lemah", "tanpa_gps"];

export const INSPECTION_STATUSES = ["draf", "final"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const KESIMPULAN = ["layak", "layak_catatan", "tidak_layak"] as const;
export type Kesimpulan = (typeof KESIMPULAN)[number];
export const LABEL_KESIMPULAN: Record<Kesimpulan, string> = {
  layak: "Layak pakai",
  layak_catatan: "Layak dengan catatan",
  tidak_layak: "Tidak layak pakai",
};

export const ISSUE_STATUSES = ["terbuka", "proses", "selesai"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const SCHEDULE_STATUSES = ["belum", "selesai", "telat"] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const TIMEZONE = "Asia/Jakarta";
export const LOCALE = "id-ID";

/** SPEC §3.6/§7.4: batas foto per inspeksi dan ukuran unggahan. */
export const MAKS_FOTO = 6;
export const MAKS_BYTE_FOTO = 12 * 1024 * 1024;

/** SPEC §3.8: tenggat temuan per tingkat, dalam hari. */
export const TENGGAT_HARI: Record<Severity, number> = { berat: 3, sedang: 14, ringan: 30 };

/** SPEC §3.1: pola token stiker. */
export const POLA_TOKEN_QR = /^PAL-K3-[0-9a-f]{32}$/i;
