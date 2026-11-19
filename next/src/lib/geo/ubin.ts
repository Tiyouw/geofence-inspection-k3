/**
 * Ubin dasar peta (Leaflet). Satu tempat untuk mengganti penyedia.
 *
 * Bawaan: CARTO "light_nolabels" (basemap tanpa label) supaya nama perusahaan/galangan dari
 * OSM tidak tampil di atas kawasan. Ketentuan CARTO basemaps: gratis untuk pemakaian non-komersial
 * dan wajib menyertakan atribusi OpenStreetMap + CARTO.
 *
 * Kembali ke ubin OSM berlabel: set NEXT_PUBLIC_UBIN_PETA=osm (dibaca saat build).
 */
export type UbinPeta = { url: string; asal: string; subdomain?: string; zoomMaksAsli: number; atribusi: string };

const ATRIBUSI_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const DAFTAR_UBIN = {
    "carto-polos": {
        url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
        asal: "https://*.basemaps.cartocdn.com",
        subdomain: "abcd",
        zoomMaksAsli: 20,
        atribusi: `${ATRIBUSI_OSM} &copy; <a href="https://carto.com/attributions">CARTO</a>`,
    },
    osm: {
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        asal: "https://tile.openstreetmap.org",
        zoomMaksAsli: 19,
        atribusi: ATRIBUSI_OSM,
    },
} satisfies Record<string, UbinPeta>;

export type KunciUbin = keyof typeof DAFTAR_UBIN;

export function kunciUbin(nilai = process.env.NEXT_PUBLIC_UBIN_PETA): KunciUbin {
    return nilai && nilai in DAFTAR_UBIN ? (nilai as KunciUbin) : "carto-polos";
}

export const UBIN_PETA: UbinPeta = DAFTAR_UBIN[kunciUbin()];

/** Semua asal ubin, untuk CSP (supaya ganti penyedia lewat env tidak memicu pelanggaran). */
export const ASAL_UBIN: string[] = Object.values(DAFTAR_UBIN).map((u) => u.asal);
