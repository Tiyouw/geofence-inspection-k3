/**
 * Potongan UI kecil panel admin. Semua warna lewat token semantik (globals.css), supaya arah
 * desain yang dipilih nanti cukup mengganti token, bukan menyunting halaman.
 */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
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
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
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
        <section className={cn("rounded-xl border bg-card text-card-foreground", className)}>
            {(judul || aksi) && (
                <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
                    {judul && <h2 className="text-sm font-semibold">{judul}</h2>}
                    {aksi}
                </header>
            )}
            <div className="p-5">{children}</div>
        </section>
    );
}

/** Tabel data sederhana dengan gulir mendatar di layar sempit. */
export function Tabel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("overflow-x-auto rounded-xl border bg-card", className)}>
            <table className="w-full text-sm [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:whitespace-nowrap [&_th]:text-muted-foreground [&_thead]:border-b [&_thead]:bg-muted/60 [&_tbody_tr]:border-b [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-muted/40">
                {children}
            </table>
        </div>
    );
}

export function Kosong({ children }: { children: ReactNode }) {
    return (
        <p className="rounded-xl border border-dashed bg-card px-5 py-10 text-center text-sm text-muted-foreground">
            {children}
        </p>
    );
}

/** <select> asli yang serupa Input shadcn: dipakai di formulir GET dan Server Action tanpa JS. */
export function Pilihan({ className, ...props }: ComponentProps<"select">) {
    return (
        <select
            className={cn(
                "h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive",
                className,
            )}
            {...props}
        />
    );
}

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
        "rounded-lg border px-3 py-1.5 text-sm hover:bg-muted aria-disabled:pointer-events-none aria-disabled:opacity-40";
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
