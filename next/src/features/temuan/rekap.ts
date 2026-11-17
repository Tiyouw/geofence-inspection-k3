/**
 * Perakit rekap temuan (PRD "Laporan": lokasi, temuan, tingkat, tindakan yang direkomendasikan,
 * tanggal, inspektur). Tanpa status, tenggat, atau PIC (ADR-4). Murni, diuji di __tests__.
 */
import { LABEL_TINDAKAN, type Severity, type TindakanRekomendasi } from "@/lib/domain/constants";
import { labelBerulang } from "./filter";

export type TemuanRekap = {
    id: number;
    asetKode: string;
    asetId: number;
    modul: string;
    lokasi: string;
    item: string;
    severity: Severity;
    tindakan: TindakanRekomendasi;
    uraianTindakan: string | null;
    waktu: Date;
    inspektur: string | null;
    berulang: number;
};

export type BarisRekapTemuan = {
    no: number;
    temuan: TemuanRekap;
    tindakan: string;
    berulang: string | null;
};

const BOBOT: Record<Severity, number> = { berat: 0, sedang: 1, ringan: 2 };

/** Urut berat → ringan, lalu terlama; nomor urut 1..n. */
export function rakitRekapTemuan(temuan: TemuanRekap[], totalUnit: number | null) {
    const baris = [...temuan]
        .sort((a, b) => BOBOT[a.severity] - BOBOT[b.severity] || a.waktu.getTime() - b.waktu.getTime() || a.id - b.id)
        .map((t, i): BarisRekapTemuan => ({
            no: i + 1,
            temuan: t,
            tindakan: LABEL_TINDAKAN[t.tindakan] + (t.uraianTindakan ? `: ${t.uraianTindakan}` : ""),
            berulang: labelBerulang(t.berulang),
        }));
    const per = (s: Severity) => baris.filter((b) => b.temuan.severity === s).length;
    return {
        baris,
        ringkas: {
            jumlah: baris.length,
            berat: per("berat"),
            sedang: per("sedang"),
            ringan: per("ringan"),
            berulang: baris.filter((b) => b.berulang).length,
            unitTerdampak: new Set(baris.map((b) => b.temuan.asetId)).size,
            totalUnit,
        },
    };
}

export type RekapTemuan = ReturnType<typeof rakitRekapTemuan>;

/**
 * Kolom tanda tangan per unit pemilik modul (PRD "Laporan"): SAT. PK untuk APAR, Hydrant, dan
 * Mobil Pemadam; Divisi Matra & K3LH untuk P3K. Jabatan {{Assumption}}.
 */
export function kolomTandaTangan(unit: string[]): [string, string][] {
    const daftar = unit.length ? unit : ["Unit pemilik"];
    return daftar.flatMap((u): [string, string][] => [
        ["Petugas Pemeriksa", u],
        ["Kepala Unit", u],
    ]);
}
