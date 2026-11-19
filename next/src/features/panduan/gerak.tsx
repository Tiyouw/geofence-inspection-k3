"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Gerak, Titik } from "./tipe";

const PUTARAN = 2;
const jeda = (ms: number) => new Promise((r) => setTimeout(r, ms));

const KUERI_HEMAT = "(prefers-reduced-motion: reduce)";
function langganHemat(cb: () => void) {
    const m = window.matchMedia(KUERI_HEMAT);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
}
/** prefers-reduced-motion sebagai state React (berubah langsung bila pengaturan sistem diganti). */
function useHematGerak(): boolean {
    return useSyncExternalStore(langganHemat, () => window.matchMedia(KUERI_HEMAT).matches, () => false);
}

/**
 * Peragaan interaksi di atas tangkapan layar: kursor (laptop) atau jari (HP) yang bergerak, mengetuk,
 * menyeret, menggambar, atau memindai. Hanya transform/opacity lewat Web Animations API, diputar
 * PUTARAN kali lalu berhenti (tombol "Putar lagi"). prefers-reduced-motion: panah dan penanda diam.
 */
export function GerakLayar({ gerak, jari }: { gerak: Gerak[]; jari: boolean }) {
    const akar = useRef<HTMLDivElement>(null);
    const kursor = useRef<HTMLSpanElement>(null);
    const riak = useRef<HTMLSpanElement>(null);
    const hantu = useRef<HTMLSpanElement>(null);
    const pil = useRef<HTMLSpanElement>(null);
    const garis = useRef<SVGPolylineElement>(null);
    const pindai = useRef<HTMLSpanElement>(null);
    const [label, setLabel] = useState<{ teks: string; p: Titik } | null>(null);
    const diam = useHematGerak();
    const [putar, setPutar] = useState(0);
    const [selesai, setSelesai] = useState(false);

    useEffect(() => {
        if (diam) return;
        const el = akar.current;
        const k = kursor.current;
        if (!el || !k) return;
        let batal = false;
        const animasi: Animation[] = [];
        const px = ([x, y]: Titik): [number, number] => [(x / 100) * el.clientWidth, (y / 100) * el.clientHeight];
        let posisi: [number, number] = px([50, 60]);
        const tr = (p: [number, number], s = 1) => `translate(${p[0]}px, ${p[1]}px) scale(${s})`;
        const main = async (node: Element, frames: Keyframe[], ms: number, easing = "cubic-bezier(.4,0,.2,1)") => {
            if (batal) throw new Error("batal");
            const a = node.animate(frames, { duration: ms, easing, fill: "forwards" });
            animasi.push(a);
            await a.finished;
        };
        const pindahKe = async (t: Titik, ms = 650) => {
            const tujuan = px(t);
            await main(k, [{ transform: tr(posisi) }, { transform: tr(tujuan) }], ms);
            posisi = tujuan;
        };
        const tekan = async () => {
            const r = riak.current!;
            r.style.transform = `translate(${posisi[0]}px, ${posisi[1]}px)`;
            await Promise.all([
                main(k, [{ transform: tr(posisi) }, { transform: tr(posisi, 0.82) }, { transform: tr(posisi) }], 320),
                main(r, [{ opacity: 0.9, scale: "0.3" }, { opacity: 0, scale: "1.6" }], 520, "ease-out"),
            ]);
        };

        const jalankan = async (g: Gerak) => {
            if (g.j === "ketuk") {
                setLabel({ teks: g.label, p: g.di });
                await pindahKe(g.di);
                await tekan();
                await jeda(500);
            } else if (g.j === "seret") {
                setLabel({ teks: g.label, p: g.ke });
                await pindahKe(g.dari);
                await tekan();
                const h = hantu.current!;
                const a = px(g.dari);
                const b = px(g.ke);
                await Promise.all([
                    main(k, [{ transform: tr(a, 0.9) }, { transform: tr(b, 0.9) }], 1300, "cubic-bezier(.5,0,.3,1)"),
                    main(h, [{ transform: tr(a), opacity: 0.95 }, { transform: tr(b), opacity: 0.95 }], 1300, "cubic-bezier(.5,0,.3,1)"),
                ]);
                posisi = b;
                await tekan();
                await main(h, [{ transform: tr(b), opacity: 0.95 }, { transform: tr(b), opacity: 0 }], 400);
                await jeda(400);
            } else if (g.j === "chip") {
                setLabel({ teks: g.label, p: g.titik[0]! });
                const p = pil.current!;
                for (const t of g.titik) {
                    await pindahKe(t, 520);
                    await Promise.all([tekan(), main(p, [{ transform: tr(px(t)), opacity: 1 }], 280)]);
                    await jeda(350);
                }
                await main(p, [{ opacity: 0 }], 300);
            } else if (g.j === "gambar") {
                setLabel({ teks: g.label, p: g.titik[0]! });
                const gl = garis.current!;
                gl.setAttribute("points", "");
                const titik: string[] = [];
                for (const t of g.titik) {
                    await pindahKe(t, titik.length ? 480 : 650);
                    titik.push(`${t[0]},${t[1]}`);
                    gl.setAttribute("points", titik.join(" "));
                    await tekan();
                }
                await jeda(900);
                gl.setAttribute("points", "");
            } else if (g.j === "pindai") {
                setLabel({ teks: g.label, p: [g.kotak[0] + g.kotak[2] / 2, g.kotak[1]] });
                const s = pindai.current!;
                const [x, y, w, h] = g.kotak;
                s.style.left = `${x}%`;
                s.style.width = `${w}%`;
                s.style.top = `${y}%`;
                const tinggi = (h / 100) * el.clientHeight;
                await main(s, [{ transform: "translateY(0)", opacity: 1 }, { transform: `translateY(${tinggi}px)`, opacity: 1 }, { transform: "translateY(0)", opacity: 1 }], 2400, "ease-in-out");
                await main(s, [{ opacity: 0 }], 200);
            }
        };

        (async () => {
            try {
                await jeda(500);
                await main(k, [{ opacity: 0, transform: tr(posisi) }, { opacity: 1, transform: tr(posisi) }], 250);
                for (let n = 0; n < PUTARAN; n++) {
                    for (const g of gerak) await jalankan(g);
                    await jeda(700);
                }
                await main(k, [{ opacity: 0, transform: tr(posisi) }], 300);
                setLabel(null);
                setSelesai(true);
            } catch {
                /* dibatalkan: langkah berganti */
            }
        })();
        return () => {
            batal = true;
            animasi.forEach((a) => a.cancel());
        };
    }, [gerak, putar, diam]);

    if (diam) return <GerakDiam gerak={gerak} />;
    return (
        <div ref={akar} className="pd-gerak" aria-hidden>
            <svg className="pd-gerak-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polyline ref={garis} points="" />
            </svg>
            <span ref={pil} className="pd-pil" />
            <span ref={hantu} className="pd-hantu" />
            <span ref={pindai} className="pd-pindai" />
            <span ref={riak} className="pd-riak" />
            <span ref={kursor} className={jari ? "pd-jari" : "pd-kursor"}>
                {!jari && (
                    <svg viewBox="0 0 24 24" width="26" height="26">
                        <path d="M4 2.5 19 13l-6.6 1.2L16 21l-3 1.4-3.6-6.9L4 19.6z" fill="#111" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                )}
            </span>
            {label && (
                <span className="pd-gerak-label" style={{ left: `${Math.min(label.p[0], 78)}%`, top: `${Math.max(label.p[1] - 7, 2)}%` }}>
                    {label.teks}
                </span>
            )}
            {selesai && (
                <button type="button" className="pd-putar" onClick={() => {
                        setSelesai(false);
                        setPutar((n) => n + 1);
                    }} aria-hidden={false} aria-label="Putar peragaan lagi">
                    <RotateCcw className="size-4" aria-hidden /> Putar lagi
                </button>
            )}
        </div>
    );
}

/** Tanpa gerak: penanda bernomor, panah seret, dan garis area sebagai gambar diam. */
function GerakDiam({ gerak }: { gerak: Gerak[] }) {
    return (
        <div className="pd-gerak" aria-hidden>
            <svg className="pd-gerak-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <marker id="pd-panah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
                        <path d="M0 0 10 5 0 10z" fill="var(--pd-sorot)" />
                    </marker>
                </defs>
                {gerak.map((g, n) =>
                    g.j === "seret" ? (
                        <line key={n} x1={g.dari[0]} y1={g.dari[1]} x2={g.ke[0]} y2={g.ke[1]} className="pd-panah" markerEnd="url(#pd-panah)" />
                    ) : g.j === "gambar" ? (
                        <polyline key={n} points={g.titik.map((t) => t.join(",")).join(" ")} />
                    ) : null,
                )}
            </svg>
            {gerak.flatMap((g, n) => {
                const titik: Titik[] = g.j === "ketuk" ? [g.di] : g.j === "seret" ? [g.dari] : g.j === "chip" ? g.titik.slice(0, -1) : g.j === "pindai" ? [[g.kotak[0] + g.kotak[2] / 2, g.kotak[1] + g.kotak[3] / 2]] : [];
                return titik.map((t, m) => (
                    <span key={`${n}-${m}`} className="pd-penanda" style={{ left: `${t[0]}%`, top: `${t[1]}%` }}>
                        {m === 0 && <span className="pd-gerak-label pd-gerak-label-diam">{g.label}</span>}
                    </span>
                ));
            })}
        </div>
    );
}
