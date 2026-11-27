/** Aturan murni dasbor admin (SPEC §4.3, §4.7). */
import { type GeometriArea, titikDalamPoligon } from "@/lib/geo/geometri";
import type { Kesimpulan } from "@/lib/domain/constants";
import { labelLokasi, namaArea } from "@/lib/domain/label-aset";

/** Hanya tiga nilai ini yang diterima. Temuan tidak punya tenggat lagi (ADR-4). */
export const TAB_ANTREAN = ["berat", "tinjauan", "belum"] as const;
export type TabAntrean = (typeof TAB_ANTREAN)[number];
export const PER_HALAMAN_ANTREAN = 6;

export const LABEL_TAB: Record<TabAntrean, string> = {
    berat: "Temuan berat bulan ini",
    tinjauan: "Perlu tinjauan",
    belum: "Belum diperiksa",
};

/** undefined → bawaan "berat"; nilai di luar daftar → null (halaman membalas 404). */
export function parseTab(nilai: string | string[] | undefined): TabAntrean | null {
    if (nilai === undefined) return "berat";
    return typeof nilai === "string" && (TAB_ANTREAN as readonly string[]).includes(nilai)
        ? (nilai as TabAntrean)
        : null;
}

/** Nomor halaman sah 1..terakhir. Halaman yang kosong setelah entri terakhir diproses dikoreksi ke halaman terakhir. */
export function halamanAman(diminta: unknown, total: number, per: number): { halaman: number; terakhir: number } {
    const terakhir = Math.max(1, Math.ceil(total / per));
    const n = Math.floor(Number(diminta));
    const halaman = Number.isFinite(n) && n >= 1 ? Math.min(n, terakhir) : 1;
    return { halaman, terakhir };
}

/** Satu desimal, 0 bila tanpa aset. */
export function persen(bagian: number, total: number): number {
    return total ? Math.round((bagian / total) * 1000) / 10 : 0;
}

export type StatusTitik = Kesimpulan | "belum" | "tanpa_kesimpulan";

export type AsetPeta = {
    id: number;
    kode: string;
    gedung: string | null;
    lantai: string | null;
    lokasiTeks: string | null;
    lat: number | null;
    lng: number | null;
    areaId?: number | null;
    /** Kesimpulan inspeksi final terakhir bulan ini; undefined = belum diperiksa. */
    kesimpulan?: Kesimpulan | null;
    sudahDiperiksa: boolean;
    tinjau: boolean;
};

/** Hanya kolom yang perlu digambar. Tidak ada token QR (SPEC §3.1, I6). */
export type TitikPeta = {
    id: number;
    kode: string;
    area: string;
    lokasi: string;
    lat: number;
    lng: number;
    status: StatusTitik;
    tinjau: boolean;
};

/** Aset yang koordinatnya jatuh di luar kawasan galangan: tidak digambar, ditandai untuk diperbaiki. */
export type LuarKawasan = { id: number; kode: string; area: string; areaId: number | null };

/**
 * Aset tanpa koordinat dihitung di tanpaTitik, tidak digambar. Bila poligon kawasan diberikan,
 * aset yang titiknya di luar kawasan juga tidak digambar (bug 19 Nov: titik seed lama tampil di
 * permukiman seolah sah) dan masuk `luarKawasan`.
 */
export function titikPeta(
    aset: AsetPeta[],
    kawasan: GeometriArea | null = null,
): { titik: TitikPeta[]; tanpaTitik: number; luarKawasan: LuarKawasan[] } {
    const titik: TitikPeta[] = [];
    const luarKawasan: LuarKawasan[] = [];
    let tanpaTitik = 0;
    for (const a of aset) {
        if (a.lat == null || a.lng == null) {
            tanpaTitik++;
            continue;
        }
        if (kawasan && !titikDalamPoligon({ lat: a.lat, lng: a.lng }, kawasan)) {
            luarKawasan.push({ id: a.id, kode: a.kode, area: namaArea(a), areaId: a.areaId ?? null });
            continue;
        }
        titik.push({
            id: a.id,
            kode: a.kode,
            area: namaArea(a),
            lokasi: labelLokasi(a),
            lat: a.lat,
            lng: a.lng,
            status: a.sudahDiperiksa ? (a.kesimpulan ?? "tanpa_kesimpulan") : "belum",
            tinjau: a.tinjau,
        });
    }
    return { titik, tanpaTitik, luarKawasan };
}

/**
 * Batas tampilan peta. Satu titik atau titik berkoordinat sama dilebarkan ±5e-5 derajat
 * supaya rentang tidak nol (tidak membagi dengan nol saat diproyeksikan).
 */
export function batasPeta(titik: { lat: number; lng: number }[]): [[number, number], [number, number]] | null {
    if (titik.length === 0) return null;
    let s = Infinity,
        w = Infinity,
        n = -Infinity,
        e = -Infinity;
    for (const t of titik) {
        s = Math.min(s, t.lat);
        n = Math.max(n, t.lat);
        w = Math.min(w, t.lng);
        e = Math.max(e, t.lng);
    }
    const PAD = 5e-5;
    if (n - s < PAD) [s, n] = [s - PAD, n + PAD];
    if (e - w < PAD) [w, e] = [w - PAD, e + PAD];
    return [
        [s, w],
        [n, e],
    ];
}
