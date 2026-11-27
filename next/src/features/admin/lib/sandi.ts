/**
 * Sandi acak untuk "Terbitkan sandi baru" (padanan `php artisan petugas:sandi`):
 * 14 karakter huruf dan angka tanpa simbol, tanpa karakter yang mudah tertukar (0/O, 1/l/I).
 */
const HURUF = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function buatSandiAcak(panjang = 14): string {
    const hasil: string[] = [];
    // Tolak sampel di atas kelipatan terbesar supaya distribusi tetap rata.
    const batas = 256 - (256 % HURUF.length);
    while (hasil.length < panjang) {
        const buf = new Uint8Array(panjang * 2);
        crypto.getRandomValues(buf);
        for (const b of buf) {
            if (b < batas && hasil.length < panjang) hasil.push(HURUF[b % HURUF.length]!);
        }
    }
    return hasil.join("");
}
