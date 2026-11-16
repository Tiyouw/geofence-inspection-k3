/** Aturan murni pencarian Ctrl+K (SPEC §4.8, PencarianPanel.php). */
import { NAV_ADMIN, NAV_PEMANTAU } from "@/components/shell/nav";
import type { Role } from "@/lib/domain/constants";

export const MIN_HURUF = 2;
export const MAKS_PER_KELOMPOK = 5;
export const MAKS_SARAN_HALAMAN = 12;

export type HasilCari = { judul: string; rincian?: string; href: string };
export type KelompokCari = { nama: string; hasil: HasilCari[] };

/** `%` dan `_` diketik apa adanya: di-escape dengan `!` (pakai `ESCAPE '!'` di SQL). */
export function escapeLike(q: string): string {
    return q.replace(/[!%_]/g, (c) => `!${c}`);
}

/** Pola ILIKE "mengandung". */
export function polaMengandung(q: string): string {
    return `%${escapeLike(q.trim())}%`;
}

/** Halaman yang boleh dilihat peran itu. */
export function halamanUntuk(role: Role): HasilCari[] {
    if (role === "admin") {
        return [
            ...NAV_ADMIN.map((n) => ({ judul: n.label, href: n.href })),
            ...NAV_PEMANTAU.map((n) => ({ judul: n.label, href: n.href })),
        ];
    }
    if (role === "pemantau") return NAV_PEMANTAU.map((n) => ({ judul: n.label, href: n.href }));
    return [];
}

/** Tindakan cepat, hanya admin. */
export function tindakanUntuk(role: Role): HasilCari[] {
    if (role !== "admin") return [];
    return [
        { judul: "Tambah aset", href: "/admin/aset/baru" },
        { judul: "Cetak lembar stiker QR", href: "/stiker" },
        { judul: "Tambah petugas", href: "/admin/pengguna/baru" },
    ];
}

export function cocok(teks: string, q: string): boolean {
    return teks.toLocaleLowerCase("id-ID").includes(q.trim().toLocaleLowerCase("id-ID"));
}
