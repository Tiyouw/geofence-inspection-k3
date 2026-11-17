/**
 * Modul Mobil Pemadam Kebakaran (SAT. PK): checklist, langkah foto, dan atribut aset.
 * Sumber: PRD PAL-K3 v2 "Checklist per modul", tab Mobil pemadam (17 Nov 2026).
 *
 * SELURUH ISI BERKAS INI ADALAH ASUMSI (PRD: {{Assumption}}). Formulir asli SAT. PK belum
 * diterima (pertanyaan 3.1 / 3.17). Acuan spesifikasi kendaraan: SNI 7053:2022 Mobil Pompa
 * Pemadam Kebakaran, menurut halaman "Standar Mobil Pemadam Kebakaran" DPI Pemadam (pompa
 * minimum 1.900 L/menit, tangki minimum 1.136 L). Acuan inspeksi kendaraan dalam dinas:
 * NFPA 1910:2024, dokumen primernya belum dibaca, jadi pasal per butir belum dapat dikutip
 * (ditandai "belum terverifikasi" pada dasar hukum).
 *
 * Objek bergerak: tanpa gerbang lokasi (status `tidak_berlaku`), GPS tetap direkam sebagai
 * informasi. Periode 7 hari (mingguan), juga asumsi.
 */
import type { AnswerType, Severity, TindakanRekomendasi } from "../constants";
import type { DefinisiLangkahFoto } from "../langkah-foto";

export const SLUG_DAMKAR = "mobil_pemadam";

/** periode_hari mobil pemadam: mingguan (PRD, {{Assumption}}). */
export const PERIODE_HARI_DAMKAR = 7;

export type ButirModul = {
    /** Urut global per tipe aset (kunci seed yang stabil), mulai 1. */
    urut: number;
    label: string;
    answerType: AnswerType;
    options?: string[];
    severityMap?: Record<string, Severity>;
    severityDefault: Severity;
    dasarHukum: string;
    keterangan?: string;
    satuan?: string;
    /** Tindakan yang direkomendasikan bila butir ini menjadi temuan. */
    tindakan: TindakanRekomendasi;
};

export type GrupModul = { kode: string; nama: string; items: ButirModul[] };

/** Bentuk langkah kamera terpandu, disepakati dengan sesi C. */
export type LangkahFotoModul = DefinisiLangkahFoto;

const BELUM_VERIFIKASI = "(belum terverifikasi)";
const NFPA = `NFPA 1910:2024 ${BELUM_VERIFIKASI}`;
const ASUMSI = "Usulan, menunggu checklist SAT. PK";

/** "Ya / Tidak" dengan Tidak sebagai temuan. */
const yaTidak = (sev: Severity) => ({
    answerType: "select" as const,
    options: ["Ya", "Tidak"],
    severityMap: { Tidak: sev },
    severityDefault: sev,
});

/** 17 butir, PRD tab Mobil pemadam. Jawaban "Baik / Tidak baik" = kondisi; "Berfungsi" = fungsi. */
export const CHECKLIST_DAMKAR: GrupModul[] = [
    {
        kode: "A",
        nama: "Kendaraan",
        items: [
            {
                urut: 1,
                label: "Oli mesin pada batas normal",
                answerType: "kondisi",
                severityDefault: "sedang",
                dasarHukum: NFPA,
                tindakan: "isi_ulang",
            },
            {
                urut: 2,
                label: "Air radiator pada batas normal",
                answerType: "kondisi",
                severityDefault: "sedang",
                dasarHukum: NFPA,
                tindakan: "isi_ulang",
            },
            {
                urut: 3,
                label: "Bahan bakar minimal 3/4 tangki",
                ...yaTidak("sedang"),
                dasarHukum: ASUMSI,
                tindakan: "isi_ulang",
            },
            {
                urut: 4,
                label: "Aki dan sistem pengisian normal",
                answerType: "kondisi",
                severityDefault: "berat",
                dasarHukum: NFPA,
                tindakan: "perbaiki",
            },
            {
                urut: 5,
                label: "Ban (tekanan, keausan, kerusakan)",
                answerType: "kondisi",
                severityDefault: "berat",
                dasarHukum: NFPA,
                tindakan: "perbaiki",
            },
            {
                urut: 6,
                label: "Rem berfungsi",
                answerType: "kondisi",
                severityDefault: "berat",
                dasarHukum: NFPA,
                tindakan: "perbaiki",
            },
            {
                urut: 7,
                label: "Lampu, rotator, dan sirene berfungsi",
                answerType: "kondisi",
                severityDefault: "sedang",
                dasarHukum: NFPA,
                tindakan: "perbaiki",
            },
        ],
    },
    {
        kode: "B",
        nama: "Pompa dan Tangki",
        items: [
            {
                urut: 8,
                label: "Pompa dapat dioperasikan (uji jalan singkat)",
                answerType: "fungsi",
                severityDefault: "berat",
                dasarHukum: `SNI 7053:2022, kinerja pompa ${BELUM_VERIFIKASI}`,
                tindakan: "perbaiki",
            },
            {
                urut: 9,
                label: "Manometer pompa terbaca normal",
                answerType: "kondisi",
                severityDefault: "sedang",
                dasarHukum: NFPA,
                tindakan: "perbaiki",
            },
            {
                urut: 10,
                label: "Tangki air penuh",
                ...yaTidak("berat"),
                dasarHukum: `SNI 7053:2022, kapasitas tangki ${BELUM_VERIFIKASI}`,
                tindakan: "isi_ulang",
            },
            { urut: 11, label: "Tangki foam terisi", ...yaTidak("sedang"), dasarHukum: ASUMSI, tindakan: "isi_ulang" },
        ],
    },
    {
        kode: "C",
        nama: "Perlengkapan",
        items: [
            {
                urut: 12,
                label: "Selang dan kopling lengkap dan baik",
                answerType: "kondisi",
                severityDefault: "sedang",
                dasarHukum: ASUMSI,
                tindakan: "lengkapi",
            },
            {
                urut: 13,
                label: "Nozzle lengkap",
                answerType: "kondisi",
                severityDefault: "sedang",
                dasarHukum: ASUMSI,
                tindakan: "lengkapi",
            },
            {
                urut: 14,
                label: "APAR di kendaraan siap pakai",
                answerType: "kondisi",
                severityDefault: "sedang",
                dasarHukum: `Permenaker 4/1980 Pasal 12 ${BELUM_VERIFIKASI}`,
                tindakan: "ganti",
            },
            {
                urut: 15,
                label: "Alat bantu pernapasan (SCBA) siap pakai",
                answerType: "kondisi",
                severityDefault: "berat",
                dasarHukum: ASUMSI,
                tindakan: "perbaiki",
            },
            {
                urut: 16,
                label: "Perlengkapan tersimpan aman dan mudah diambil",
                answerType: "kondisi",
                severityDefault: "ringan",
                dasarHukum: 'DPI Pemadam: "lokasi penyimpanan yang aman, terlindungi dan mudah diakses"',
                tindakan: "perbaiki",
            },
        ],
    },
    {
        kode: "D",
        nama: "Catatan",
        items: [
            {
                urut: 17,
                label: "Odometer",
                answerType: "number",
                satuan: "km",
                severityDefault: "ringan",
                dasarHukum: "Catatan, bukan temuan",
                keterangan: "Angka tanpa baku: tidak pernah menjadi temuan.",
                tindakan: "lainnya",
            },
        ],
    },
];

/** Urutan kamera terpandu mobil pemadam (ADR-8). Setiap butir masuk minimal satu langkah. */
export const LANGKAH_FOTO_DAMKAR: LangkahFotoModul[] = [
    {
        kode: "kendaraan",
        judul: "Ruang mesin, ban, dan lampu",
        petunjuk: "Kap mesin terbuka (oli, radiator, aki), lalu ban dan lampu menyala.",
        butir: [1, 2, 4, 5, 6, 7],
    },
    {
        kode: "bbm-odometer",
        judul: "Panel instrumen",
        petunjuk: "Penunjuk bahan bakar dan angka odometer terbaca.",
        butir: [3, 17],
    },
    { kode: "pompa", judul: "Panel pompa dan manometer", butir: [8, 9] },
    { kode: "tangki", judul: "Penunjuk tangki air dan foam", butir: [10, 11] },
    {
        kode: "perlengkapan",
        judul: "Perlengkapan di kendaraan",
        petunjuk: "Selang, nozzle, APAR, SCBA, dan tempat penyimpanannya.",
        butir: [12, 13, 14, 15, 16],
    },
];

/** Atribut aset mobil pemadam di `assets.attributes` (PRD). */
export const ATRIBUT_DAMKAR = [
    { kunci: "nomor_lambung", label: "Nomor lambung", jenis: "teks" },
    { kunci: "nopol", label: "Nomor polisi", jenis: "teks" },
    { kunci: "kapasitas_tangki_l", label: "Kapasitas tangki air (L)", jenis: "angka" },
    { kunci: "kapasitas_pompa_lpm", label: "Kapasitas pompa (L/menit)", jenis: "angka" },
] as const;

export type AtributDamkar = {
    nomor_lambung?: string;
    nopol?: string;
    kapasitas_tangki_l?: number;
    kapasitas_pompa_lpm?: number;
};

/** "PMK-01 · B 1234 XY" untuk daftar dan laporan; null bila belum diisi. */
export function identitasDamkar(a: AtributDamkar | null | undefined): string | null {
    const bagian = [a?.nomor_lambung, a?.nopol].map((v) => (v ?? "").trim()).filter(Boolean);
    return bagian.length ? bagian.join(" · ") : null;
}
