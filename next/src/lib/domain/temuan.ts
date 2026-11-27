/**
 * Temuan sederhana (PRD "Temuan", ADR-4): catatan lokasi, temuan, tingkat, dan tindakan yang
 * direkomendasikan. Tanpa status, tenggat, PIC, atau penutupan: laporan adalah akhir alur.
 * Murni, dipakai finalisasi (peladen), pratinjau formulir, daftar temuan, dan laporan.
 */
import { labelLokasi } from "./label-aset";

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
