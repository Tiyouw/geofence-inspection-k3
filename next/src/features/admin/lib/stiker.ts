/**
 * Lembar stiker QR (SPEC §4.4, StikerController.php). Ukuran dalam milimeter, untuk kertas label
 * A4 potret yang dipotong pabrik: jangan ubah tanpa mengukur hasil cetak.
 */
export const TATA_LETAK = {
    "3x8": { kolom: 3, baris: 8, lebar: 63.5, tinggi: 33.9, nama: "24 label per lembar (63,5 x 33,9 mm)" },
    "2x5": { kolom: 2, baris: 5, lebar: 99.1, tinggi: 57.0, nama: "10 label per lembar (99,1 x 57 mm)" },
    "2x4": { kolom: 2, baris: 4, lebar: 99.1, tinggi: 67.7, nama: "8 label per lembar (99,1 x 67,7 mm)" },
} as const;
export type KodeTata = keyof typeof TATA_LETAK;
export const TATA_BAWAAN: KodeTata = "2x5";

export function parseTata(nilai: string | undefined): KodeTata {
    return nilai && nilai in TATA_LETAK ? (nilai as KodeTata) : TATA_BAWAAN;
}

/** Ukuran cetak QR dan kode aset bergantung tinggi label. */
export function ukuranLabel(kode: KodeTata): { qrMm: number; kodeMm: number } {
    const besar = TATA_LETAK[kode].tinggi > 40;
    return { qrMm: besar ? 26 : 20, kodeMm: besar ? 4.6 : 3.8 };
}

/** "APAR-001, APAR-014 ,," → ["APAR-001", "APAR-014"] (cetak ulang satu-dua stiker). */
export function parseDaftarKode(nilai: string | undefined): string[] {
    return (nilai ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean)
        .slice(0, 200);
}

export function bagiLembar<T>(daftar: T[], perLembar: number): T[][] {
    const hasil: T[][] = [];
    for (let i = 0; i < daftar.length; i += perLembar) hasil.push(daftar.slice(i, i + perLembar));
    return hasil;
}

/** Isi QR: URL lengkap, supaya kamera bawaan ponsel pun bisa membukanya (SPEC §3.1). */
export function urlStiker(origin: string, token: string): string {
    return `${origin.replace(/\/+$/, "")}/i/${token}`;
}
