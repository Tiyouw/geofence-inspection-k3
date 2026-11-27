/**
 * Progres panduan: langkah yang sudah benar-benar dilihat, disimpan per perangkat (localStorage).
 *
 * Sengaja tidak dipisah per nama: nama hanya diisi di widget masukan (bawaan "Faldy"), jadi
 * memisah per nama malah membuat semua pengunjung berbagi progres "Faldy".
 *
 * Kunci v1 ("pal-k3-panduan-dikunjungi") mencentang langkah begitu dilewati, termasuk langkah
 * pertama saat halaman dibuka dan setiap langkah saat panah ditahan, sehingga cepat penuh.
 * Kunci itu dibuang; v2 hanya berisi langkah yang ditampilkan minimal {@link LAMA_DILIHAT_MS}.
 */
export const KUNCI_PROGRES = "pal-k3-panduan-dilihat-v2";
export const KUNCI_LAMA = "pal-k3-panduan-dikunjungi";
export const LAMA_DILIHAT_MS = 1500;

type Penyimpanan = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Langkah yang tersimpan, hanya id yang masih ada di panduan. Membuang kunci v1. */
export function bacaProgres(simpan: Penyimpanan, idSah: readonly string[]): string[] {
    try {
        simpan.removeItem(KUNCI_LAMA);
        const v: unknown = JSON.parse(simpan.getItem(KUNCI_PROGRES) ?? "[]");
        return Array.isArray(v) ? idSah.filter((id) => v.includes(id)) : [];
    } catch {
        return [];
    }
}

/** Menambah satu langkah yang sudah dilihat; mengembalikan daftar yang sama bila sudah ada. */
export function tambahDilihat(simpan: Penyimpanan, dilihat: string[], id: string): string[] {
    if (dilihat.includes(id)) return dilihat;
    const baru = [...dilihat, id];
    try {
        simpan.setItem(KUNCI_PROGRES, JSON.stringify(baru));
    } catch {}
    return baru;
}

export function hapusProgres(simpan: Penyimpanan): void {
    try {
        simpan.removeItem(KUNCI_PROGRES);
        simpan.removeItem(KUNCI_LAMA);
    } catch {}
}
