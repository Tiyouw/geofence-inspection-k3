"use client";

import { Check, ChevronLeft, ChevronRight, ExternalLink, KeyRound, Laptop, ListOrdered, Monitor, Smartphone, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/shell/brand";
import { IlustrasiModul, type ModulIlustrasi as Modul } from "@/components/ilustrasi/modul";
import { GerakLayar } from "./gerak";
import { WidgetMasukan } from "./masukan";
import { AKUN_DEMO, BAB, type Slide, type Sorot } from "./tipe";

const MODUL: Record<string, Modul> = { apar: "apar", p3k: "p3k", hp: "hydrant_pilar", pmk: "mobil_pemadam" };
const KUNCI_KUNJUNGAN = "pal-k3-panduan-dikunjungi";

function baca<T>(k: string, cadangan: T): T {
    try {
        const v = localStorage.getItem(k);
        return v ? (JSON.parse(v) as T) : cadangan;
    } catch {
        return cadangan;
    }
}
function tulis(k: string, v: unknown) {
    try {
        localStorage.setItem(k, JSON.stringify(v));
    } catch {}
}

const peranData = (s: Slide) => (s.peran === "umum" ? "inspektur" : s.peran);

/**
 * Panduan varian B (kanvas b31e6c236866, desain 3-4): daftar langkah + instruksi + pratinjau.
 * Layar lebar: tiga kolom. Ponsel: satu langkah per layar, pratinjau bisa dilipat, dok bawah.
 * Navigasi: panah/PageUp/PageDown/Home/End, geser di ponsel, #id langkah di URL.
 */
export function Panduan({
    slides,
    qr,
    stiker,
    demo,
}: {
    slides: Slide[];
    qr: Record<string, string>;
    stiker: Record<string, string>;
    demo: boolean;
}) {
    const [i, setI] = useState(0);
    const [arah, setArah] = useState<1 | -1>(1);
    const [dikunjungi, setDikunjungi] = useState<string[]>([]);
    const [daftarBuka, setDaftarBuka] = useState(false);
    const [pilihMode, setPilihMode] = useState<{ id: string; mode: "gambar" | "langsung" } | null>(null);
    const s = slides[i]!;
    // Pratinjau kembali ke tangkapan layar setiap pindah langkah.
    const mode = pilihMode?.id === s.id ? pilihMode.mode : "gambar";
    const setMode = (m: "gambar" | "langsung") => setPilihMode({ id: s.id, mode: m });

    const tandai = useCallback((id: string) => {
        setDikunjungi((d) => {
            if (d.includes(id)) return d;
            const baru = [...d, id];
            tulis(KUNCI_KUNJUNGAN, baru);
            return baru;
        });
    }, []);

    // Langkah awal dari #id dan langkah yang pernah dibuka (penyimpanan peramban): dibaca setelah
    // hidrasi supaya HTML peladen dan klien sama.
    useEffect(() => {
        const dariHash = () => {
            const n = slides.findIndex((x) => `#${x.id}` === location.hash);
            if (n >= 0) setI(n);
        };
        const hashAwal = location.hash;
        const r = requestAnimationFrame(() => {
            // Penanda untuk uji E2E: navigasi papan ketik sudah aktif.
            document.querySelector(".pd")?.setAttribute("data-siap", "");
            const lama = baca<string[]>(KUNCI_KUNJUNGAN, []);
            const n = slides.findIndex((x) => `#${x.id}` === hashAwal);
            const awal = slides[Math.max(n, 0)]!.id;
            setDikunjungi(lama.includes(awal) ? lama : [...lama, awal]);
            if (n >= 0) setI(n);
        });
        window.addEventListener("hashchange", dariHash);
        return () => {
            cancelAnimationFrame(r);
            window.removeEventListener("hashchange", dariHash);
        };
    }, [slides]);

    useEffect(() => {
        document.querySelector(".pd-samping [aria-current=step]")?.scrollIntoView({ block: "nearest" });
    }, [s.id]);

    const ke = useCallback(
        (n: number) => {
            const t = Math.max(0, Math.min(slides.length - 1, n));
            setArah(t >= i ? 1 : -1);
            setI(t);
            setDaftarBuka(false);
            tandai(slides[t]!.id);
            history.replaceState(null, "", `#${slides[t]!.id}`);
        },
        [i, slides, tandai],
    );

    useEffect(() => {
        const tombol = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement;
            if (el.closest("input, textarea, select, [contenteditable], [role=dialog]")) return;
            if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !el.closest("button, a"))) {
                e.preventDefault();
                ke(i + 1);
            } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
                e.preventDefault();
                ke(i - 1);
            } else if (e.key === "Home") ke(0);
            else if (e.key === "End") ke(slides.length - 1);
        };
        window.addEventListener("keydown", tombol);
        return () => window.removeEventListener("keydown", tombol);
    }, [i, ke, slides.length]);

    // Geser kiri/kanan di ponsel (bukan di atas tangkapan layar yang bisa digulir).
    const sentuh = useRef<{ x: number; y: number } | null>(null);
    const mulaiGeser = (e: React.TouchEvent) => {
        const t = e.touches[0]!;
        sentuh.current = { x: t.clientX, y: t.clientY };
    };
    const akhirGeser = (e: React.TouchEvent) => {
        const a = sentuh.current;
        sentuh.current = null;
        if (!a) return;
        const t = e.changedTouches[0]!;
        const dx = t.clientX - a.x;
        if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(t.clientY - a.y)) ke(i + (dx < 0 ? 1 : -1));
    };

    const perBab = useMemo(() => BAB.map((b) => ({ bab: b, item: slides.map((x, n) => ({ x, n })).filter(({ x }) => x.bab === b) })), [slides]);
    const konteks = `Langkah ${i + 1} · ${s.bab} · ${s.judul}`;

    const daftar = (
        <nav aria-label="Semua langkah" className="pd-daftar">
            {perBab.map(({ bab, item }) => (
                <div key={bab}>
                    <p className="pd-daftar-bab">{bab}</p>
                    <ol>
                        {item.map(({ x, n }) => (
                            <li key={x.id}>
                                <button
                                    type="button"
                                    onClick={() => ke(n)}
                                    aria-current={n === i ? "step" : undefined}
                                    className="pd-daftar-item"
                                >
                                    <span className="pd-cek" data-on={dikunjungi.includes(x.id) || undefined} aria-hidden>
                                        {dikunjungi.includes(x.id) ? <Check className="size-3" strokeWidth={3} /> : n + 1}
                                    </span>
                                    <span className="min-w-0 flex-1">{x.judul}</span>
                                </button>
                            </li>
                        ))}
                    </ol>
                </div>
            ))}
        </nav>
    );

    return (
        <div className="pd" data-peran={peranData(s)}>
            <header className="pd-atas">
                <Link href="/" className="pd-merek" aria-label="Geofence Inspection K3, beranda">
                    <span className="pd-merek-tanda" aria-hidden>
                        <BrandMark className="size-6" />
                    </span>
                    <span>
                        <b>Panduan</b>
                        <small className="pd-lebar-saja">Geofence Inspection K3 · coba langkah demi langkah</small>
                    </span>
                </Link>
                <ol className="pd-bab" aria-label="Bab">
                    {BAB.map((b) => {
                        const n = slides.findIndex((x) => x.bab === b);
                        return (
                            <li key={b}>
                                <button type="button" aria-current={s.bab === b ? "true" : undefined} onClick={() => ke(n)}>
                                    {b}
                                </button>
                            </li>
                        );
                    })}
                </ol>
                <span className="pd-hitung" aria-live="polite">
                    {i + 1}/{slides.length}
                </span>
                <button type="button" className="pd-tombol-daftar pd-hp-saja" onClick={() => setDaftarBuka(true)} aria-label="Semua langkah">
                    <ListOrdered className="size-5" aria-hidden />
                </button>
            </header>
            <div className="pd-progres" role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={i + 1} aria-label="Progres panduan">
                <i style={{ width: `${((i + 1) / slides.length) * 100}%` }} />
            </div>

            <div className="pd-badan">
                <aside className="pd-samping pd-lebar-saja">{daftar}</aside>

                <main className="pd-isi" onTouchStart={mulaiGeser} onTouchEnd={akhirGeser}>
                    <article key={s.id} className="pd-langkah" data-arah={arah}>
                        <p className="pd-eyebrow">
                            <span className="pd-titik" aria-hidden />
                            {s.bab}
                            {s.alat && (
                                <span className="pd-alat">
                                    {s.alat === "hp" ? <Smartphone className="size-3.5" aria-hidden /> : <Laptop className="size-3.5" aria-hidden />}
                                    {s.alat === "hp" ? "Di HP" : "Di laptop"}
                                </span>
                            )}
                        </p>
                        <h1>{s.judul}</h1>
                        <p className="pd-lead">{s.teks}</p>
                        <IsiKhusus s={s} stiker={stiker} demo={demo} />
                        {s.langkah && (
                            <ol className="pd-steps">
                                {s.langkah.map((l) => (
                                    <li key={l}>{l}</li>
                                ))}
                            </ol>
                        )}
                        {demo && s.akun && <KotakAkun akun={s.akun} />}
                        {s.catatan && <p className="pd-catatan">{s.catatan}</p>}
                        {(s.coba || s.qr) && (
                            <div className="pd-coba">
                                {s.coba && (
                                    <a className="pd-btn pd-btn-utama" href={s.coba.href} target="_blank" rel="noopener">
                                        Coba sekarang: {s.coba.label} <ExternalLink className="size-4" aria-hidden />
                                    </a>
                                )}
                                {(s.qr?.[0] ? qr[s.qr[0].kunci] : s.alat === "hp" && s.coba ? qr[s.coba.href] : undefined) && (
                                    <figure className="pd-qr pd-lebar-saja">
                                        <span dangerouslySetInnerHTML={{ __html: (s.qr?.[0] ? qr[s.qr[0].kunci] : qr[s.coba!.href])! }} />
                                        <figcaption>{s.qr?.[0]?.label ?? "Pindai untuk membuka di HP"}</figcaption>
                                    </figure>
                                )}
                            </div>
                        )}
                    </article>

                    {(s.shot || s.trio || s.duo) && (
                        <details className="pd-lipat pd-hp-saja" open>
                            <summary>Tampilan di aplikasi</summary>
                            <Pratinjau s={s} mode="gambar" />
                        </details>
                    )}

                    <nav className="pd-nav pd-lebar-saja" aria-label="Pindah langkah">
                        <button type="button" className="pd-btn" onClick={() => ke(i - 1)} disabled={i === 0}>
                            <ChevronLeft className="size-4" aria-hidden /> Kembali
                        </button>
                        <span className="pd-kbd">← → untuk pindah</span>
                        <button type="button" className="pd-btn pd-btn-utama" onClick={() => ke(i + 1)} disabled={i === slides.length - 1}>
                            Lanjut <ChevronRight className="size-4" aria-hidden />
                        </button>
                    </nav>
                </main>

                <section className="pd-pratinjau pd-lebar-saja" aria-label="Pratinjau">
                    {s.coba && s.alat === "laptop" && (
                        <div className="pd-seg" role="group" aria-label="Jenis pratinjau">
                            <button type="button" aria-pressed={mode === "gambar"} onClick={() => setMode("gambar")}>
                                <Monitor className="size-4" aria-hidden /> Tangkapan layar
                            </button>
                            <button type="button" aria-pressed={mode === "langsung"} onClick={() => setMode("langsung")}>
                                <ExternalLink className="size-4" aria-hidden /> Langsung
                            </button>
                        </div>
                    )}
                    <Pratinjau key={s.id + mode} s={s} mode={mode} />
                </section>
            </div>

            <nav className="pd-dok pd-hp-saja" aria-label="Pindah langkah">
                <button type="button" className="pd-btn" onClick={() => ke(i - 1)} disabled={i === 0} aria-label="Kembali">
                    <ChevronLeft className="size-5" aria-hidden />
                </button>
                {s.coba ? (
                    <a className="pd-btn pd-btn-utama flex-1" href={s.coba.href} target="_blank" rel="noopener">
                        Coba sekarang
                    </a>
                ) : (
                    <span className="flex-1 text-center text-sm text-[var(--peran-redup)]">Geser untuk pindah</span>
                )}
                <button type="button" className="pd-btn pd-btn-utama" onClick={() => ke(i + 1)} disabled={i === slides.length - 1} aria-label="Lanjut">
                    <ChevronRight className="size-5" aria-hidden />
                </button>
            </nav>

            {daftarBuka && (
                <div className="pd-lembar-latar pd-hp-saja" onClick={() => setDaftarBuka(false)}>
                    <div role="dialog" aria-modal="true" aria-label="Semua langkah" className="pd-lembar" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between pb-2">
                            <b>Semua langkah</b>
                            <button type="button" className="pd-ikon" onClick={() => setDaftarBuka(false)} aria-label="Tutup">
                                <X className="size-5" aria-hidden />
                            </button>
                        </div>
                        {daftar}
                    </div>
                </div>
            )}

            <WidgetMasukan konteks={konteks} langkah={s.id} />
        </div>
    );
}

function KotakAkun({ akun }: { akun: NonNullable<Slide["akun"]> }) {
    const a = AKUN_DEMO[akun];
    return (
        <p className="pd-akun">
            <KeyRound className="size-4 shrink-0 text-[var(--peran-utama)]" aria-hidden />
            <span>
                Akun demo: <code>{a.nip}</code> / <code>{a.sandi}</code>
            </span>
            <span className="pd-akun-alat">{a.alat}</span>
        </p>
    );
}

function IsiKhusus({ s, stiker, demo }: { s: Slide; stiker: Record<string, string>; demo: boolean }): ReactNode {
    if (s.kolom)
        return (
            <div className="pd-kolom">
                {s.kolom.map((k, n) => (
                    <div key={k.judul} data-baru={n === 1 || undefined}>
                        <h2>{k.judul}</h2>
                        <ul>
                            {k.butir.map((b) => (
                                <li key={b}>{b}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        );
    if (s.modul)
        return (
            <ul className="pd-modul">
                {s.modul.map((m) => (
                    <li key={m.kunci}>
                        <IlustrasiModul modul={MODUL[m.kunci] ?? "apar"} ukuran={56} />
                        <span>
                            <b>{m.nama}</b>
                            {m.teks}
                        </span>
                    </li>
                ))}
            </ul>
        );
    if (s.peranlist)
        return (
            <ul className="pd-peran">
                {s.peranlist.map((p) => (
                    <li key={p.peran} data-peran={p.peran}>
                        <b>
                            {p.nama} <small>{p.alat}</small>
                        </b>
                        <span>{p.teks}</span>
                        {demo && <code>{p.akun}</code>}
                    </li>
                ))}
            </ul>
        );
    if (s.stiker) {
        const ada = s.stiker.filter((x) => stiker[x.kode]);
        if (!ada.length) return <p className="pd-catatan">Stiker contoh hanya tersedia di server percobaan.</p>;
        return (
            <ul className="pd-stiker" aria-label="Stiker contoh">
                {ada.map((x) => (
                    <li key={x.kode}>
                        <span className="pd-stiker-qr" dangerouslySetInnerHTML={{ __html: stiker[x.kode]! }} />
                        <span className="pd-stiker-teks">
                            <IlustrasiModul modul={MODUL[x.modul] ?? "apar"} ukuran={24} />
                            <b>{x.kode}</b>
                            <small>{x.jenis}</small>
                        </span>
                        <span className="pd-pindai-garis" aria-hidden />
                    </li>
                ))}
            </ul>
        );
    }
    return null;
}

/** Tangkapan layar dalam bingkai perangkat, dengan sorotan dan gerak tangan/kursor. */
function Pratinjau({ s, mode }: { s: Slide; mode: "gambar" | "langsung" }) {
    if (mode === "langsung" && s.coba)
        return (
            <div className="pd-laptop pd-langsung">
                <div className="pd-bilah-url">{s.coba.href}</div>
                <iframe src={s.coba.href} title={`Aplikasi langsung: ${s.coba.label}`} loading="lazy" />
            </div>
        );
    if (s.trio)
        return (
            <div className="pd-trio">
                {s.trio.map((t) => (
                    <figure key={t.shot} data-nada={t.nada}>
                        <Layar shot={t.shot} alat="hp" judul={t.judul} />
                        <figcaption>
                            <b>{t.judul}</b>
                            {t.teks}
                        </figcaption>
                    </figure>
                ))}
            </div>
        );
    if (s.duo)
        return (
            <div className="pd-trio pd-duo">
                {s.duo.map((d) => (
                    <figure key={d.shot}>
                        <Layar shot={d.shot} alat="hp" judul={d.label} hot={[d.hot]} />
                        <figcaption>{d.label}</figcaption>
                    </figure>
                ))}
            </div>
        );
    if (!s.shot) return <SampulPratinjau s={s} />;
    return <Layar shot={s.shot} alat={s.alat ?? "laptop"} judul={s.judul} hot={s.hot} gerak={s.gerak} />;
}

function Layar({ shot, alat, judul, hot, gerak }: { shot: string; alat: "hp" | "laptop"; judul: string; hot?: Sorot[]; gerak?: Slide["gerak"] }) {
    return (
        <div className={alat === "hp" ? "pd-hp" : "pd-laptop"}>
            <div className="pd-layar">
                {/* eslint-disable-next-line @next/next/no-img-element -- gambar statis kecil, ukuran tetap */}
                <img src={`/panduan/${shot}.webp`} alt={`Tangkapan layar: ${judul}`} width={alat === "hp" ? 780 : 1440} height={alat === "hp" ? 1688 : 900} />
                {hot?.map((h) => (
                    <span
                        key={h.label}
                        className="pd-sorot"
                        style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` }}
                    >
                        <span className="pd-sorot-label">{h.label}</span>
                    </span>
                ))}
                {gerak && <GerakLayar gerak={gerak} jari={alat === "hp"} />}
            </div>
        </div>
    );
}

function SampulPratinjau({ s }: { s: Slide }) {
    return (
        <div className="pd-sampul" aria-hidden>
            <div className="pd-sampul-modul">
                {(["apar", "p3k", "hydrant_pilar", "mobil_pemadam"] as Modul[]).map((m) => (
                    <IlustrasiModul key={m} modul={m} ukuran={88} />
                ))}
            </div>
            <p>{s.jenis === "selesai" ? "Tekan Masukan di pojok kanan bawah kapan saja." : "Perusahaan Galangan Kapal · Inspeksi peralatan darurat K3"}</p>
        </div>
    );
}
