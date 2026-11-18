/**
 * Potongan UI kecil panel admin. Semua warna lewat token semantik (globals.css), supaya arah
 * desain yang dipilih nanti cukup mengganti token, bukan menyunting halaman.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { PesanMuncul } from "@/components/ui/pesan-muncul";
import { cn } from "@/lib/utils";
import type { Nada } from "../lib/label";

const NADA: Record<Nada, string> = {
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    info: "bg-info-soft text-info",
    muted: "bg-muted text-muted-foreground",
};

export function Lencana({
    nada = "muted",
    children,
    className,
}: {
    nada?: Nada;
    children: ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
                NADA[nada],
                className,
            )}
        >
            {children}
        </span>
    );
}

export function Kartu({
    judul,
    aksi,
    children,
    className,
}: {
    judul?: ReactNode;
    aksi?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn("rounded-kartu border bg-card text-card-foreground", className)}>
            {(judul || aksi) && (
                <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-1">
                    {judul && <h2 className="text-base font-bold">{judul}</h2>}
                    {aksi}
                </header>
            )}
            <div className="p-5 pt-3">{children}</div>
        </section>
    );
}

/**
 * Tabel data. Di layar sempit (< md) baris menjadi kartu bertumpuk, jadi tidak ada gulir mendatar;
 * beri `data-label="Judul kolom"` pada <td> agar judulnya tampil di atas nilainya.
 */
export function Tabel({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
    return (
        <div className={cn("rounded-kartu border bg-card md:overflow-x-auto", className)}>
            <table aria-label={label} className="w-full text-sm max-md:block max-md:[&_tbody]:block max-md:[&_thead]:sr-only max-md:[&_tbody_tr]:flex max-md:[&_tbody_tr]:flex-col max-md:[&_tbody_tr]:gap-1 max-md:[&_tbody_tr]:px-4 max-md:[&_tbody_tr]:py-3 max-md:[&_td]:!p-0 max-md:[&_td[data-label]]:before:block max-md:[&_td[data-label]]:before:text-xs max-md:[&_td[data-label]]:before:text-muted-foreground max-md:[&_td[data-label]]:before:content-[attr(data-label)] [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:whitespace-nowrap [&_th]:text-muted-foreground [&_thead]:border-b [&_thead]:bg-muted/60 [&_tbody_tr]:border-b [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-muted/40">
                {children}
            </table>
        </div>
    );
}

/** Keadaan kosong; `ilustrasi` mis. <IlustrasiModul> dari components/ilustrasi/modul. */
export function Kosong({ children, ilustrasi }: { children: ReactNode; ilustrasi?: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-kartu border border-dashed bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            {ilustrasi}
            <p className="max-w-md">{children}</p>
        </div>
    );
}

/** Kontrol pilih bersama (pengganti <select> asli): lihat src/components/ui/pilihan.tsx. */
export { Pilihan } from "@/components/ui/pilihan";

/** Label + kontrol + galat, dengan aria-describedby untuk pembaca layar. */
export function Bidang({
    label,
    htmlFor,
    galat,
    bantuan,
    children,
    className,
}: {
    label: string;
    htmlFor: string;
    galat?: string[];
    bantuan?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <label htmlFor={htmlFor} className="text-sm font-medium">
                {label}
            </label>
            {children}
            {bantuan && (
                <p id={`${htmlFor}-bantuan`} className="text-xs text-muted-foreground">
                    {bantuan}
                </p>
            )}
            <PesanMuncul
                id={`${htmlFor}-galat`}
                pesan={galat?.length ? galat.join(" ") : undefined}
                celah="0.375rem"
                isiClassName="text-xs font-medium text-danger"
            />
        </div>
    );
}

/** Paginasi dengan tautan (tetap mempertahankan parameter filter). */
export function Paginasi({
    halaman,
    total,
    per,
    hrefUntuk,
}: {
    halaman: number;
    total: number;
    per: number;
    hrefUntuk: (h: number) => string;
}) {
    const terakhir = Math.max(1, Math.ceil(total / per));
    if (terakhir <= 1) return null;
    const tombol =
        "inline-flex min-h-10 items-center rounded-kontrol border bg-card px-3 text-sm font-semibold hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-40";
    return (
        <nav aria-label="Halaman" className="mt-4 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
                Halaman {halaman} dari {terakhir} · {total} entri
            </span>
            <div className="flex gap-2">
                <Link className={tombol} href={hrefUntuk(halaman - 1)} aria-disabled={halaman <= 1}>
                    Sebelumnya
                </Link>
                <Link className={tombol} href={hrefUntuk(halaman + 1)} aria-disabled={halaman >= terakhir}>
                    Berikutnya
                </Link>
            </div>
        </nav>
    );
}

/** Bangun query string dari objek, membuang nilai kosong. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null || v === "" || v === false) continue;
        u.set(k, v === true ? "1" : String(v));
    }
    const s = u.toString();
    return s ? `?${s}` : "";
}

export function halamanDari(v: string | string[] | undefined): number {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 1 ? n : 1;
}
