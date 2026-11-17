/**
 * Temuan sederhana (PRD "Temuan", ADR-4): catatan lokasi, temuan, tingkat, dan tindakan yang
 * direkomendasikan. Tanpa status, tenggat, PIC, atau penutupan: laporan adalah akhir alur.
 * Murni, dipakai finalisasi (peladen), pratinjau formulir, daftar temuan, dan laporan.
 */
import type { Severity } from "./constants";
import { bangunTemuan, type ButirChecklist, type Jawaban, type Temuan } from "./inspeksi";
import { labelLokasi } from "./label-aset";

/**
 * Temuan tambahan per modul, untuk butir yang dinilai bukan dari `nilai` (mis. isi P3K:
 * jumlah, kondisi, kedaluwarsa; sesi D). Hasilnya menggantikan temuan butir yang sama.
 */
export type PenilaiModul = (items: ButirChecklist[], jawaban: Jawaban[]) => Temuan[];

const URUT: Record<Severity, number> = { berat: 0, sedang: 1, ringan: 2 };

/** Semua temuan sebuah inspeksi: aturan umum, lalu aturan khusus modul bila ada. */
export function temuanInspeksi(items: ButirChecklist[], jawaban: Jawaban[], penilaiModul?: PenilaiModul): Temuan[] {
    const umum = bangunTemuan(items, jawaban);
    if (!penilaiModul) return umum;
    const khusus = penilaiModul(items, jawaban);
    const diganti = new Set(khusus.map((t) => t.checklistItemId));
    return [...umum.filter((t) => !diganti.has(t.checklistItemId)), ...khusus].sort(
        (a, b) => URUT[a.severity] - URUT[b.severity],
    );
}

/**
 * Lokasi temuan sebagai teks, disalin saat inspeksi final supaya laporan tetap benar walau
 * aset dipindah: "{area/gedung} · {lantai} · {keterangan titik}". Objek bergerak: keterangan
 * titik (pos) ditambah identitas kendaraan bila ada.
 */
export function lokasiTemuan(a: {
    area?: string | null;
    gedung?: string | null;
    lantai?: string | null;
    lokasiTeks?: string | null;
    identitas?: string | null;
}): string {
    const gedung = a.area?.trim() || a.gedung?.trim() || null;
    const titik = labelLokasi({ lokasiTeks: a.lokasiTeks, lantai: a.lantai });
    const bagian = [gedung, titik === "-" ? null : titik, a.identitas?.trim() || null].filter(Boolean);
    return bagian.join(" · ") || "-";
}

/**
 * Temuan berulang (PRD, {{Assumption}}): berapa kali butir yang sama pada aset yang sama
 * sudah menjadi temuan. Kunci "{assetId}:{checklistItemId}".
 */
export function hitungBerulang(daftar: { assetId: number; checklistItemId: number | null }[]): Map<string, number> {
    const n = new Map<string, number>();
    for (const t of daftar) {
        if (t.checklistItemId == null) continue;
        const k = `${t.assetId}:${t.checklistItemId}`;
        n.set(k, (n.get(k) ?? 0) + 1);
    }
    return n;
}
