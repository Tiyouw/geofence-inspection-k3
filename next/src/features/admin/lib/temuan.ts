/** Siklus tindak lanjut temuan (SPEC §3.8, §9 celah #4-5). Murni, tanpa basis data. */
import type { IssueStatus, Severity } from "@/lib/domain/constants";

export const LABEL_STATUS_TEMUAN: Record<IssueStatus, string> = {
    terbuka: "Terbuka",
    proses: "Dalam proses",
    selesai: "Selesai",
};

export const LABEL_SEVERITY: Record<Severity, string> = { berat: "Berat", sedang: "Sedang", ringan: "Ringan" };

/** Tindakan baku yang dicetak bila tindak_lanjut kosong. */
export const TINDAKAN_BAKU: Record<Severity, string> = {
    berat: "Tabung diturunkan dari layanan, diganti unit cadangan",
    sedang: "Dijadwalkan perbaikan dalam tenggat yang ditetapkan",
    ringan: "Dibenahi pada kunjungan berikutnya",
};

/**
 * terbuka → proses → selesai; terbuka → selesai (langsung dari dasbor);
 * proses → terbuka (dikembalikan); selesai → terbuka (dibuka kembali oleh admin).
 */
const TRANSISI: Record<IssueStatus, IssueStatus[]> = {
    terbuka: ["proses", "selesai"],
    proses: ["terbuka", "selesai"],
    selesai: ["terbuka"],
};

export function bolehTransisi(dari: IssueStatus, ke: IssueStatus): boolean {
    return TRANSISI[dari].includes(ke);
}

export function transisiBerikut(dari: IssueStatus): IssueStatus[] {
    return TRANSISI[dari];
}

/** Uraian wajib (≥ 10 karakter) untuk menyelesaikan atau membuka kembali. */
export function butuhUraian(ke: IssueStatus, dari: IssueStatus): boolean {
    return ke === "selesai" || (dari === "selesai" && ke === "terbuka");
}

/** Tenggat sudah lewat bila tanggalnya sebelum hari ini dan temuan belum selesai. */
export function lewatTenggat(t: { status: IssueStatus; targetSelesai: string | null }, hariIni: string): boolean {
    return t.status !== "selesai" && t.targetSelesai !== null && t.targetSelesai < hariIni;
}

const BOBOT: Record<Severity, number> = { berat: 0, sedang: 1, ringan: 2 };

/** Urut berat → sedang → ringan, lalu terlama. */
export function urutTemuan<T extends { severity: Severity; createdAt: Date }>(daftar: T[]): T[] {
    return [...daftar].sort(
        (a, b) => BOBOT[a.severity] - BOBOT[b.severity] || a.createdAt.getTime() - b.createdAt.getTime(),
    );
}
