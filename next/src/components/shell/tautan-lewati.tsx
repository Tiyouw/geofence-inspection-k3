/** Tautan "Lewati ke konten" untuk pengguna papan ketik: tersembunyi sampai difokus (audit 19 Nov 2026). */
export function TautanLewati() {
    return (
        <a
            href="#isi"
            className="sr-only rounded-kontrol bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100]"
        >
            Lewati ke konten
        </a>
    );
}
