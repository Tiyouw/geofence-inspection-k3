/**
 * Isi sambutan dan tur terpandu per peran (onboarding varian B, kanvas b31e6c236866 desain 7-8).
 * `sel`: pemilih CSS, dipakai elemen pertama yang terlihat (bilah samping di laptop, menu bawah di
 * ponsel). Langkah yang elemennya tidak ada di halaman dilewati.
 */
import type { Role } from "@/lib/domain/constants";

export type LangkahTur = { sel: string[]; judul: string; teks: string };
export type IsiOnboarding = { nama: string; sapa: string; intro: string; tur: LangkahTur[] };

const BANTUAN: LangkahTur = {
    sel: ["[data-tur=bantuan]"],
    judul: "Bantuan kapan saja",
    teks: "Buka tur ini lagi atau panduan lengkap dari tombol ini.",
};
const MENU: LangkahTur = {
    sel: ['aside nav[aria-label="Menu utama"]', 'nav[aria-label="Menu bawah"]'],
    judul: "Menu utama",
    teks: "Harian untuk kerja sehari-hari, Data untuk aset, lokasi, dan laporan.",
};

export const ONBOARDING: Record<Role, IsiOnboarding> = {
    admin: {
        nama: "Admin K3",
        sapa: "Selamat datang, Admin K3",
        intro: "Dari sini kamu memantau keempat modul, memutuskan kiriman yang perlu ditinjau, dan menyiapkan jadwal serta stiker.",
        tur: [
            MENU,
            { sel: ["[data-testid=progres-modul]"], judul: "Progres per modul", teks: "Satu kartu per modul. Garis berwarna menunjukkan berapa yang sudah diperiksa periode ini." },
            { sel: ['nav[aria-label="Antrean keputusan"]'], judul: "Perlu keputusanmu", teks: "Temuan berat, kiriman yang perlu ditinjau, dan aset yang belum diperiksa. Klik untuk membuka daftarnya." },
            { sel: ["[data-tur=cari]"], judul: "Cari cepat", teks: "Cari aset, temuan, atau inspeksi dari halaman mana pun (Ctrl K)." },
            BANTUAN,
        ],
    },
    pemantau: {
        nama: "Pemantau",
        sapa: "Selamat datang, Pemantau",
        intro: "Kamu bisa melihat seluruh galangan tanpa mengubah data: ringkasan siap dibacakan, temuan berat, tinjauan, dan laporan PDF.",
        tur: [
            { ...MENU, teks: "Papan pantau, tinjauan, inspeksi, temuan, dan laporan." },
            { sel: ["[data-testid=narasi]"], judul: "Ringkasan dalam kalimat", teks: "Paragraf ini siap dibacakan atau disalin ke laporan untuk manajemen." },
            { sel: ["[aria-labelledby=judul-lap]"], judul: "Laporan siap cetak", teks: "Unduh Lembar PMS dan rekap temuan sebagai PDF." },
            BANTUAN,
        ],
    },
    inspektur: {
        nama: "Inspektur",
        sapa: "Selamat datang, Inspektur",
        intro: "Aplikasi ini memandumu memeriksa peralatan K3: pindai stiker, isi butir cek, foto, lalu kirim. Tetap jalan walau sinyal hilang.",
        tur: [
            { sel: ["[data-tur=progres]"], judul: "Progres periode", teks: "Berapa aset yang sudah diperiksa periode ini dan kapan tenggatnya." },
            { sel: ['main a[href="/petugas/pindai"]'], judul: "Pindai stiker", teks: "Mulai setiap inspeksi dari sini: arahkan kamera ke stiker QR di dekat peralatan." },
            { sel: ['nav[aria-label="Menu petugas"]'], judul: "Menu bawah", teks: "Antrean berisi kiriman yang menunggu sinyal; Riwayat berisi yang sudah terkirim." },
            BANTUAN,
        ],
    },
};

export const sudahSelesai = (selesai: readonly string[] | null | undefined, peran: Role) => !!selesai?.includes(peran);
