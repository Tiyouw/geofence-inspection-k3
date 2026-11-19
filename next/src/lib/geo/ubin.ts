/**
 * Ubin dasar peta (Leaflet). Satu tempat untuk mengganti penyedia.
 *
 * Bawaan: Esri "World Light Gray Base" (kanvas kelabu tanpa nama tempat/perusahaan; hanya nama
 * jalan) supaya label galangan dari OSM tidak tampil di atas kawasan. Tanpa kunci API, data asli
 * sampai zoom 16 (di atasnya diperbesar). Atribusi Esri dan OpenStreetMap wajib.
 * CARTO light_nolabels kini menampilkan tanda "API KEY REQUIRED" di luar localhost (dicoba di dev
 * 19 Nov 2026), jadi hanya dipakai bila ada akun CARTO.
 *
 * Pilih lewat NEXT_PUBLIC_UBIN_PETA (dibaca saat build): esri-kelabu (bawaan), carto-polos, osm.
 */
export type UbinPeta = { url: string; asal: string; subdomain?: string; zoomMaksAsli: number; atribusi: string };

const ATRIBUSI_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const DAFTAR_UBIN = {
    "esri-kelabu": {
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        asal: "https://server.arcgisonline.com",
        zoomMaksAsli: 16,
        atribusi: `Ubin &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, ${ATRIBUSI_OSM}`,
    },
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
    return nilai && nilai in DAFTAR_UBIN ? (nilai as KunciUbin) : "esri-kelabu";
}

export const UBIN_PETA: UbinPeta = DAFTAR_UBIN[kunciUbin()];

/** Semua asal ubin, untuk CSP (supaya ganti penyedia lewat env tidak memicu pelanggaran). */
export const ASAL_UBIN: string[] = Object.values(DAFTAR_UBIN).map((u) => u.asal);
