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

/**
 * Semua nilai enum Postgres `gate_status`. Enum Postgres hanya bisa ditambah, jadi nilai
 * lama (v1) tetap ada untuk data yang sudah tersimpan. Inspeksi baru hanya memakai
 * GATE_STATUSES_V2 (PRD "Aturan gerbang lokasi", ADR-2/ADR-7).
 */
export const GATE_STATUSES = [
  "sesuai",
  "perlu_review",
  "jauh",
  "gps_lemah",
  "tanpa_gps",
  "tidak_berlaku",
  "perlu_tinjauan",
] as const;
export type GateStatus = (typeof GATE_STATUSES)[number];
/** Tiga hasil gerbang v2. Penolakan tidak disimpan sebagai inspeksi (audit `inspeksi.ditolak_lokasi`). */
export const GATE_STATUSES_V2 = ["sesuai", "perlu_tinjauan", "tidak_berlaku"] as const;
export type GateStatusV2 = (typeof GATE_STATUSES_V2)[number];
/** Nilai v1 yang tidak lagi ditulis; dipetakan ke `perlu_tinjauan` + alasan (Tech Spec migrasi 3). */
export const GATE_STATUS_LAMA: Partial<Record<GateStatus, GateAlasan>> = {
  perlu_review: "di_luar_gedung",
  jauh: "di_luar_gedung",
  gps_lemah: "gps_lemah",
  tanpa_gps: "gps_lemah",
};
/** Status gerbang yang masuk antrean tinjauan (v1 dan v2). */
export const GATE_PERLU_TINJAUAN: GateStatus[] = ["perlu_tinjauan", "perlu_review", "jauh", "gps_lemah", "tanpa_gps"];

/** Alasan status `perlu_tinjauan`. */
export const GATE_ALASAN = ["di_luar_gedung", "gps_lemah"] as const;
export type GateAlasan = (typeof GATE_ALASAN)[number];
export const LABEL_GATE_ALASAN: Record<GateAlasan, string> = {
  di_luar_gedung: "Di luar gedung aset",
  gps_lemah: "GPS lemah",
};

/** Kunci tabel `settings` untuk toleransi gerbang (meter), dengan nilai bawaan PRD. */
export const SETTING_GERBANG = {
  toleransiGedungM: "gerbang.toleransi_gedung_m",
  toleransiKawasanM: "gerbang.toleransi_kawasan_m",
  akurasiLemahM: "gerbang.akurasi_lemah_m",
} as const;
export const SETTING_GERBANG_BAWAAN: Record<(typeof SETTING_GERBANG)[keyof typeof SETTING_GERBANG], number> = {
  "gerbang.toleransi_gedung_m": 30,
  "gerbang.toleransi_kawasan_m": 50,
  "gerbang.akurasi_lemah_m": 100,
};

/** Jenis area. `kawasan` = batas galangan (satu); lainnya = area tempat aset terdaftar. */
export const AREA_JENIS = ["kawasan", "gedung", "bengkel", "dok", "dermaga"] as const;
export type AreaJenis = (typeof AREA_JENIS)[number];
export const LABEL_AREA_JENIS: Record<AreaJenis, string> = {
  kawasan: "Kawasan galangan",
  gedung: "Gedung",
  bengkel: "Bengkel",
  dok: "Dok",
  dermaga: "Dermaga",
};

/**
 * Hasil tinjauan inspeksi "perlu tinjauan" / "area terbatas". Antrean = final, butuh tinjauan,
 * `ditinjau_pada` kosong. Peninjau pertama (Administrator K3 atau Pemantau) tercatat (ADR-9).
 */
export const HASIL_TINJAUAN = ["diterima", "ditolak"] as const;
export type HasilTinjauan = (typeof HASIL_TINJAUAN)[number];
export const LABEL_HASIL_TINJAUAN: Record<HasilTinjauan, string> = { diterima: "Diterima", ditolak: "Ditolak" };
/** Peran yang boleh meninjau. */
export const PERAN_PENINJAU: Role[] = ["admin", "pemantau"];

/** Slug tipe aset v2 (PRD F7-F10). `hydrant` dan `damkar` adalah slug lama. */
export const ASSET_TYPE_SLUGS = ["apar", "p3k", "hydrant_pilar", "hydrant_box", "mobil_pemadam"] as const;
export type AssetTypeSlug = (typeof ASSET_TYPE_SLUGS)[number];

/** Kode unit kerja pemilik modul (PRD "Unit kerja"). */
export const DIVISI = { satPk: "SATPK", matra: "MATRA" } as const;
export type KodeDivisi = (typeof DIVISI)[keyof typeof DIVISI];
/** Unit pemilik per tipe aset. */
export const PEMILIK_TIPE: Record<AssetTypeSlug, KodeDivisi> = {
  apar: "SATPK",
  hydrant_pilar: "SATPK",
  hydrant_box: "SATPK",
  mobil_pemadam: "SATPK",
  p3k: "MATRA",
};

/** Tipe kotak P3K (Permenakertrans PER.15/MEN/VIII/2008 Lampiran II-III). */
export const TIPE_KOTAK_P3K = ["A", "B", "C"] as const;
export type TipeKotakP3k = (typeof TIPE_KOTAK_P3K)[number];
/** Kondisi satu isi kotak P3K. */
export const KONDISI_ISI = ["aman", "kedaluwarsa"] as const;
export type KondisiIsi = (typeof KONDISI_ISI)[number];
/** Tanggal kedaluwarsa terdekat <= ini (hari) = catatan "segera kedaluwarsa", bukan temuan. */
export const SEGERA_KEDALUWARSA_HARI = 30;

/** Tindakan yang direkomendasikan untuk temuan (PRD "Temuan"). Tanpa alur tindak lanjut. */
export const TINDAKAN_REKOMENDASI = ["perbaiki", "ganti", "isi_ulang", "lengkapi", "lainnya"] as const;
export type TindakanRekomendasi = (typeof TINDAKAN_REKOMENDASI)[number];
export const LABEL_TINDAKAN: Record<TindakanRekomendasi, string> = {
  perbaiki: "Perbaiki",
  ganti: "Ganti",
  isi_ulang: "Isi ulang",
  lengkapi: "Lengkapi",
  lainnya: "Lainnya",
};

/** Kamera terpandu (ADR-8): jepretan per langkah. */
export const MAKS_FOTO_PER_LANGKAH = 5;

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
/**
 * Batas unggahan satu foto: di bawah batas badan permintaan Vercel (4,5 MB). Foto kamera
 * terpandu dikompres ≤ 1600 px JPEG 0,82 (± 0,3–0,8 MB), jadi 4 MB longgar (audit 19 Nov 2026).
 */
export const MAKS_BYTE_FOTO = 4 * 1024 * 1024;

/** SPEC §3.8: tenggat temuan per tingkat, dalam hari. */
export const TENGGAT_HARI: Record<Severity, number> = { berat: 3, sedang: 14, ringan: 30 };

/** SPEC §3.1: pola token stiker. */
export const POLA_TOKEN_QR = /^PAL-K3-[0-9a-f]{32}$/i;

