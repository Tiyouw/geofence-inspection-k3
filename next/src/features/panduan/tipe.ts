export type PeranPanduan = "umum" | "inspektur" | "admin" | "pemantau";
export type Sorot = { x: number; y: number; w: number; h: number; label: string };
export type Titik = [number, number];

/** Gerak tangan/kursor di atas tangkapan layar (persen gambar). */
export type Gerak =
    | { j: "ketuk"; di: Titik; label: string }
    | { j: "seret"; dari: Titik; ke: Titik; label: string }
    | { j: "chip"; titik: Titik[]; label: string }
    | { j: "gambar"; titik: Titik[]; label: string }
    | { j: "pindai"; kotak: [number, number, number, number]; label: string };

export type Slide = {
    id: string;
    bab: string;
    peran: PeranPanduan;
    jenis?: "sampul" | "masalah" | "modul" | "peran" | "stiker" | "trio" | "duo" | "selesai";
    judul: string;
    teks: string;
    alat?: "hp" | "laptop";
    shot?: string;
    langkah?: string[];
    hot?: Sorot[];
    gerak?: Gerak[];
    akun?: "inspektur" | "admin" | "pemantau";
    coba?: { label: string; href: string };
    qr?: { kunci: string; label: string }[];
    catatan?: string;
    kolom?: { judul: string; butir: string[] }[];
    modul?: { kunci: string; nama: string; teks: string }[];
    peranlist?: { peran: string; nama: string; alat: string; teks: string; akun: string }[];
    stiker?: { kode: string; jenis: string; modul: string }[];
    trio?: { shot: string; judul: string; teks: string; nada: "ok" | "warn" | "bad" }[];
    duo?: { shot: string; label: string; hot: Sorot }[];
};

export const AKUN_DEMO: Record<NonNullable<Slide["akun"]>, { nip: string; sandi: string; alat: string }> = {
    inspektur: { nip: "inspektur", sandi: "inspektur123", alat: "HP" },
    admin: { nip: "admin", sandi: "admin123", alat: "Laptop" },
    pemantau: { nip: "pemantau", sandi: "pemantau123", alat: "Laptop" },
};

export const BAB = ["Pengenalan", "Inspektur", "Admin K3", "Pemantau", "Selesai"] as const;
