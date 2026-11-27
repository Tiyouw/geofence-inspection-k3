"use client";

import { BookOpen, CircleHelp, RotateCcw, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import { selesaikanOnboarding } from "./aksi";
import { ONBOARDING, type LangkahTur } from "./tur";

const EVENT_TUR = "onboarding:tur";
const kunciNanti = (uid: number, peran: Role) => `onboarding-nanti-${uid}-${peran}`;

function terlihat(el: Element): boolean {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
}
function cariTarget(l: LangkahTur): Element | null {
    for (const s of l.sel) for (const el of document.querySelectorAll(s)) if (terlihat(el)) return el;
    return null;
}
/**
 * Peramban otomatis (uji E2E) tidak disambut, supaya kartu tidak menutupi tombol di uji lain;
 * uji onboarding menyalakannya dengan localStorage "onboarding-uji" = "1".
 */
function otomatisTanpaSambutan(): boolean {
    if (!navigator.webdriver) return false;
    try {
        return localStorage.getItem("onboarding-uji") !== "1";
    } catch {
        return true;
    }
}
function sesi(k: string, v?: string): string | null {
    try {
        if (v !== undefined) sessionStorage.setItem(k, v);
        return sessionStorage.getItem(k);
    } catch {
        return null;
    }
}

/**
 * Onboarding varian B (kanvas b31e6c236866 desain 7-8): sambutan sebagai kartu pojok (laptop) atau
 * lembar bawah (ponsel) tanpa menggelapkan layar; tur dengan cincin pada elemen asli dan kartu
 * pemandu tetap. Muncul saat masuk sampai tur selesai atau "Jangan ingatkan saya lagi" dicentang
 * (tersimpan di server per akun dan peran). "Nanti saja" hanya menunda sampai sesi peramban berikut.
 * Tombol "?" (TombolBantuan) membuka tur lagi lewat peristiwa EVENT_TUR atau ?tur=1 di beranda peran.
 */
export function Onboarding({ peran, userId, sambut, beranda }: { peran: Role; userId: number; sambut: boolean; beranda: string }) {
    const isi = ONBOARDING[peran];
    const [mode, setMode] = useState<"diam" | "sambut" | "tur">("diam");
    const [langkah, setLangkah] = useState<LangkahTur[]>([]);
    const [i, setI] = useState(0);
    const [kotak, setKotak] = useState<DOMRect | null>(null);
    const [jangan, setJangan] = useState(false);
    const id = useId();
    const path = usePathname();
    const kartu = useRef<HTMLDivElement>(null);

    const mulaiTur = useCallback(() => {
        const ada = isi.tur.filter((l) => cariTarget(l));
        if (!ada.length) return setMode("diam");
        setLangkah(ada);
        setI(0);
        setMode("tur");
    }, [isi.tur]);

    // Awal: ?tur=1 (dari tombol "?" di halaman lain) atau sambutan. Ditunda satu bingkai supaya isi halaman sudah tergambar.
    useEffect(() => {
        const r = requestAnimationFrame(() => {
            const url = new URL(location.href);
            if (url.searchParams.get("tur") === "1") {
                url.searchParams.delete("tur");
                history.replaceState(null, "", url.pathname + url.search + url.hash);
                setTimeout(mulaiTur, 400);
            } else if (sambut && path === beranda && !sesi(kunciNanti(userId, peran)) && !otomatisTanpaSambutan()) {
                setMode("sambut");
            }
        });
        const dengar = () => mulaiTur();
        window.addEventListener(EVENT_TUR, dengar);
        return () => {
            cancelAnimationFrame(r);
            window.removeEventListener(EVENT_TUR, dengar);
        };
        // Hanya saat pertama dipasang; pindah halaman tidak memunculkan sambutan lagi.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cincin mengikuti elemen saat digulir atau ukuran berubah.
    const target = mode === "tur" ? langkah[i] : undefined;
    useEffect(() => {
        if (!target) return;
        const el = cariTarget(target);
        if (!el) return;
        el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        let r = 0;
        const ukur = () => {
            setKotak(el.getBoundingClientRect());
            r = requestAnimationFrame(ukur);
        };
        r = requestAnimationFrame(ukur);
        return () => cancelAnimationFrame(r);
    }, [target]);

    useEffect(() => {
        if (mode === "diam") return;
        const esc = (e: KeyboardEvent) => {
            if (e.key === "Escape") tutup(false);
            if (mode === "tur" && e.key === "ArrowRight") lanjut();
            if (mode === "tur" && e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
        };
        window.addEventListener("keydown", esc);
        return () => window.removeEventListener("keydown", esc);
    });

    function tutup(selesai: boolean) {
        if (selesai || jangan) void selesaikanOnboarding().catch(() => {});
        else sesi(kunciNanti(userId, peran), "1");
        setMode("diam");
        setKotak(null);
    }
    function lanjut() {
        if (i >= langkah.length - 1) tutup(true);
        else setI(i + 1);
    }

    if (mode === "diam") return null;

    if (mode === "sambut")
        return (
            <section
                role="dialog"
                aria-labelledby={`${id}-judul`}
                data-peran-onboarding={peran}
                className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-dialog border bg-card p-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] text-card-foreground shadow-2xl motion-safe:animate-[onb-naik_.3s_ease-out] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[400px] sm:rounded-dialog sm:p-6"
            >
                <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
                <button type="button" onClick={() => tutup(false)} aria-label="Tutup" className="absolute top-4 right-4 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted">
                    <X className="size-5" aria-hidden />
                </button>
                <span className="inline-flex rounded-full bg-peran-utama-rona px-3 py-1 text-xs font-bold tracking-wide text-peran-utama uppercase">{isi.nama}</span>
                <h2 id={`${id}-judul`} className="mt-3 text-xl font-extrabold tracking-tight">
                    {isi.sapa}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{isi.intro}</p>
                <p className="mt-4 text-[13px] text-muted-foreground">Tur singkat · {isi.tur.length} langkah · sekitar 1 menit</p>
                <ol className="mt-2 grid gap-2 text-sm">
                    {isi.tur.map((l, n) => (
                        <li key={l.judul} className="flex items-center gap-3">
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">{n + 1}</span>
                            {l.judul}
                        </li>
                    ))}
                </ol>
                <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
                    <input type="checkbox" checked={jangan} onChange={(e) => setJangan(e.target.checked)} className="size-5 accent-[var(--peran-utama)]" />
                    Jangan ingatkan saya lagi
                </label>
                <div className="mt-4 flex gap-3">
                    <Button variant="ghost" className="h-11" onClick={() => tutup(false)}>
                        Nanti saja
                    </Button>
                    <Button className="h-11 flex-1" onClick={mulaiTur}>
                        Mulai tur
                    </Button>
                </div>
            </section>
        );

    const l = langkah[i]!;
    // Ponsel: kartu pemandu pindah ke atas bila elemen ada di separuh bawah layar.
    const atas = kotak && typeof window !== "undefined" && kotak.top + kotak.height / 2 > window.innerHeight / 2;
    const cincin: CSSProperties | undefined = kotak
        ? { left: kotak.left - 6, top: kotak.top - 6, width: kotak.width + 12, height: kotak.height + 12 }
        : undefined;
    return (
        <>
            {cincin && <div aria-hidden className="onb-cincin pointer-events-none fixed z-50 rounded-[14px]" style={cincin} />}
            <div
                ref={kartu}
                role="dialog"
                aria-labelledby={`${id}-tur`}
                aria-live="polite"
                className={cn(
                    "fixed inset-x-0 z-50 border bg-card p-5 text-card-foreground shadow-2xl sm:inset-x-auto sm:top-auto sm:right-6 sm:bottom-6 sm:w-[400px] sm:rounded-kartu",
                    atas ? "top-0 rounded-b-dialog pt-[calc(16px+env(safe-area-inset-top))]" : "bottom-0 rounded-t-dialog pb-[calc(20px+env(safe-area-inset-bottom))]",
                )}
            >
                <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-peran-utama transition-[width] duration-300" style={{ width: `${((i + 1) / langkah.length) * 100}%` }} />
                </div>
                <p className="text-xs font-bold tracking-wide text-peran-utama">
                    LANGKAH {i + 1} DARI {langkah.length}
                </p>
                <h2 id={`${id}-tur`} className="mt-1 text-[17px] font-extrabold">
                    {l.judul}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{l.teks}</p>
                <div className="mt-4 flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="mr-auto" onClick={() => tutup(false)}>
                        Lewati tur
                    </Button>
                    <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}>
                        Kembali
                    </Button>
                    <Button size="sm" onClick={lanjut}>
                        {i === langkah.length - 1 ? "Selesai" : "Lanjut"}
                    </Button>
                </div>
            </div>
        </>
    );
}

/**
 * Tombol "?" tetap: di bilah samping laptop ("Bantuan & panduan") atau melayang di ponsel. Menunya
 * membuka tur lagi (di beranda peran) atau /panduan di tab baru.
 */
export function TombolBantuan({
    varian,
    beranda,
    className,
    hanyaDi,
}: {
    varian: "samping" | "melayang";
    beranda: string;
    className?: string;
    /** Tombol melayang hanya di halaman menu ini (tidak menutupi tombol Kirim di formulir). */
    hanyaDi?: string[];
}) {
    const [buka, setBuka] = useState(false);
    const path = usePathname();
    const router = useRouter();
    const id = useId();
    const akar = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!buka) return;
        const luar = (e: PointerEvent) => !akar.current?.contains(e.target as Node) && setBuka(false);
        const esc = (e: KeyboardEvent) => e.key === "Escape" && setBuka(false);
        document.addEventListener("pointerdown", luar);
        document.addEventListener("keydown", esc);
        return () => {
            document.removeEventListener("pointerdown", luar);
            document.removeEventListener("keydown", esc);
        };
    }, [buka]);

    function ulangTur() {
        setBuka(false);
        if (path === beranda) window.dispatchEvent(new Event(EVENT_TUR));
        else router.push(`${beranda}?tur=1`);
    }

    if (hanyaDi && !hanyaDi.includes(path)) return null;

    const menu = buka && (
        <div
            id={`${id}-menu`}
            role="menu"
            className={cn(
                "absolute z-50 w-[264px] rounded-kartu border bg-card p-2 text-card-foreground shadow-xl",
                varian === "samping" ? "bottom-full left-0 mb-2" : "right-0 bottom-full mb-3",
            )}
        >
            <button type="button" role="menuitem" onClick={ulangTur} className="flex w-full items-start gap-3 rounded-kontrol p-3 text-left text-sm font-semibold hover:bg-muted">
                <RotateCcw className="mt-0.5 size-4 shrink-0 text-peran-utama" aria-hidden />
                <span>
                    Ulangi tur
                    <small className="block font-normal text-muted-foreground">Kenali bagian layar beranda</small>
                </span>
            </button>
            <a
                role="menuitem"
                href="/panduan"
                target="_blank"
                rel="noopener"
                onClick={() => setBuka(false)}
                className="flex w-full items-start gap-3 rounded-kontrol p-3 text-left text-sm font-semibold hover:bg-muted"
            >
                <BookOpen className="mt-0.5 size-4 shrink-0 text-peran-utama" aria-hidden />
                <span>
                    Buka panduan lengkap
                    <small className="block font-normal text-muted-foreground">Langkah demi langkah, tab baru</small>
                </span>
            </a>
        </div>
    );

    return (
        <div ref={akar} className={cn("relative", varian === "melayang" && "fixed right-4 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40", className)}>
            <button
                type="button"
                data-tur="bantuan"
                aria-haspopup="menu"
                aria-expanded={buka}
                aria-controls={buka ? `${id}-menu` : undefined}
                aria-label={varian === "melayang" ? "Bantuan dan panduan" : undefined}
                onClick={() => setBuka((b) => !b)}
                className={
                    varian === "samping"
                        ? "flex h-10 w-full items-center gap-3 rounded-kontrol px-3 text-sm font-medium text-sidebar-foreground hover:bg-peran-sorot"
                        : "grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
                }
            >
                <CircleHelp className={varian === "samping" ? "size-[18px] text-muted-foreground" : "size-6"} aria-hidden />
                {varian === "samping" && "Bantuan & panduan"}
            </button>
            {menu}
        </div>
    );
}
