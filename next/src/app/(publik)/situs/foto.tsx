/**
 * Foto media PT PAL dengan srcset (resources/views/components/situs/foto.blade.php).
 * Berkas di public/media/pal dengan pola <berkas>-<lebar>.webp; asal-usul di SUMBER.md.
 * <img> biasa, bukan next/image: berkas sudah diperkecil dan srcset-nya tetap seperti situs lama.
 */
export function Foto({
    berkas,
    alt,
    lebar = [800, 1600],
    sizes = "100vw",
    zoomPelan,
}: {
    berkas: string;
    alt: string;
    lebar?: number[];
    sizes?: string;
    zoomPelan?: boolean;
}) {
    const daftar = [...lebar].sort((a, b) => a - b);
    const url = (w: number) => `/media/pal/${berkas}-${w}.webp`;
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={url(daftar[daftar.length - 1]!)}
            srcSet={daftar.map((w) => `${url(w)} ${w}w`).join(", ")}
            sizes={sizes}
            alt={alt}
            loading="lazy"
            decoding="async"
            data-zoom-pelan={zoomPelan ? "" : undefined}
            className="s:size-full s:object-cover"
        />
    );
}
