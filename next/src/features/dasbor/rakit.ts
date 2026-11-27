/**
 * Perakit progres dasbor lintas empat modul (PRD F14): % aset sudah dicek per modul dan per
 * gedung, masing-masing pada periode modulnya (bulan; minggu untuk mobil pemadam). Murni.
 */
import { KESIMPULAN, type Kesimpulan } from "@/lib/domain/constants";

export type AsetProgres = {
    /** Kunci slot: id aset (periode berjalan) atau "{id aset}@{periode}" (laporan per bulan). */
    id: number | string;
    kode: string;
    modulSlug: string;
    modul: string;
    /** Nama area/gedung; null untuk aset tanpa area (mis. mobil pemadam). */
    area: string | null;
    lokasi: string;
    /** Periode slot ("YYYY-MM-DD"), untuk laporan per bulan yang memuat beberapa minggu. */
    periode?: string;
};

/** Inspeksi final terakhir aset di periode modulnya; tidak ada = belum dicek. */
export type CekTerakhir = { kesimpulan: Kesimpulan | null };

export type Hitung = { total: number; sudah: number; persen: number };

export const persen = (sudah: number, total: number) => (total ? Math.round((sudah / total) * 1000) / 10 : 0);

const hitung = (total: number, sudah: number): Hitung => ({ total, sudah, persen: persen(sudah, total) });

export const AREA_TANPA_NAMA = "Tanpa area (objek bergerak)";

/**
 * Nama "gedung" untuk progres dan laporan: area yang ditunjuk aset (gedung, bengkel, dok, dermaga;
 * area bersarang tidak digulung ke induknya), cadangan teks gedung lama, lalu "Tanpa area".
 */
export function namaGedung(area: string | null | undefined, gedung: string | null | undefined): string {
    return area?.trim() || gedung?.trim() || AREA_TANPA_NAMA;
}

export function rakitProgres(
    modul: { slug: string; nama: string; periode: string; jatuhTempo: string; mingguan: boolean }[],
    aset: AsetProgres[],
    cek: Map<number | string, CekTerakhir>,
) {
    const kondisi = Object.fromEntries(KESIMPULAN.map((k) => [k, 0])) as Record<Kesimpulan, number>;
    for (const a of aset) {
        const k = cek.get(a.id)?.kesimpulan;
        if (k) kondisi[k]++;
    }

    const perModul = modul.map((m) => {
        const milik = aset.filter((a) => a.modulSlug === m.slug);
        return { ...m, ...hitung(milik.length, milik.filter((a) => cek.has(a.id)).length) };
    });

    const area = new Map<string, { modul: Map<string, { total: number; sudah: number }>; belum: AsetProgres[] }>();
    for (const a of aset) {
        const nama = namaGedung(a.area, null);
        const v = area.get(nama) ?? {
            modul: new Map<string, { total: number; sudah: number }>(),
            belum: [] as AsetProgres[],
        };
        const m = v.modul.get(a.modulSlug) ?? { total: 0, sudah: 0 };
        m.total++;
        if (cek.has(a.id)) m.sudah++;
        else v.belum.push(a);
        v.modul.set(a.modulSlug, m);
        area.set(nama, v);
    }
    const perArea = [...area.entries()]
        .map(([nama, v]) => {
            const total = [...v.modul.values()].reduce((n, m) => n + m.total, 0);
            const sudah = [...v.modul.values()].reduce((n, m) => n + m.sudah, 0);
            return {
                nama,
                ...hitung(total, sudah),
                modul: modul
                    .filter((m) => v.modul.has(m.slug))
                    .map((m) => ({
                        slug: m.slug,
                        nama: m.nama,
                        ...hitung(v.modul.get(m.slug)!.total, v.modul.get(m.slug)!.sudah),
                    })),
                belum: v.belum.sort((a, b) => a.kode.localeCompare(b.kode, "id")),
            };
        })
        .sort(
            (a, b) =>
                Number(a.nama === AREA_TANPA_NAMA) - Number(b.nama === AREA_TANPA_NAMA) ||
                a.nama.localeCompare(b.nama, "id"),
        );

    const sudah = aset.filter((a) => cek.has(a.id)).length;
    return { ...hitung(aset.length, sudah), belum: aset.length - sudah, kondisi, perModul, perArea };
}

export type Progres = ReturnType<typeof rakitProgres>;

export type HitunganArea = { perluTinjauan: number; ditolak: number; temuan: number };

/**
 * Baris laporan "Progres per gedung" (PRD F15): progres per modul dari `rakitProgres` ditambah,
 * per gedung, inspeksi yang menunggu tinjauan, inspeksi yang ditolak peninjau, dan jumlah temuan
 * pada periode itu. Gedung yang hanya punya hitungan (mis. aset sudah nonaktif) tetap tampil.
 */
export function barisLaporanProgres(progres: Pick<Progres, "perArea" | "total" | "sudah" | "persen">, hitungan: Map<string, HitunganArea>) {
    const kosong: HitunganArea = { perluTinjauan: 0, ditolak: 0, temuan: 0 };
    const baris = progres.perArea.map((a) => ({ ...a, ...(hitungan.get(a.nama) ?? kosong) }));
    for (const [nama, h] of hitungan) {
        if (!baris.some((b) => b.nama === nama)) {
            baris.push({ nama, total: 0, sudah: 0, persen: 0, modul: [], belum: [], ...h });
        }
    }
    const jumlah = (k: keyof HitunganArea) => baris.reduce((n, b) => n + b[k], 0);
    return {
        baris,
        total: {
            total: progres.total,
            sudah: progres.sudah,
            persen: progres.persen,
            perluTinjauan: jumlah("perluTinjauan"),
            ditolak: jumlah("ditolak"),
            temuan: jumlah("temuan"),
        },
    };
}
