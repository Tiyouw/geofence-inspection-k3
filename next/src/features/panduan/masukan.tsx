"use client";

import { ImagePlus, MessageSquareText, Send, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { JENIS_MASUKAN, LABEL_JENIS_MASUKAN, MAKS_ISI, type JenisMasukan } from "@/features/masukan/jenis";

const KUNCI_NAMA = "pal-k3-panduan-nama";
const SISI_MAKS = 1600;

/** Perkecil tangkapan layar di peramban: JPEG, sisi terpanjang ≤ 1600 px (ponsel sering > 5 MB). */
async function perkecil(berkas: File): Promise<Blob> {
    const bmp = await createImageBitmap(berkas);
    const skala = Math.min(1, SISI_MAKS / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * skala);
    c.height = Math.round(bmp.height * skala);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return new Promise((ok, gagal) => c.toBlob((b) => (b ? ok(b) : gagal(new Error("Gagal memproses gambar."))), "image/jpeg", 0.82));
}

/**
 * Tombol Masukan melayang + panel (bisa ditutup dan dibuka lagi). Konteks terisi otomatis dengan
 * langkah yang sedang dibuka. Kirim ke POST /api/masukan; admin diberi tahu lewat realtime.
 */
export function WidgetMasukan({ konteks, langkah }: { konteks: string; langkah: string }) {
    const [buka, setBuka] = useState(false);
    const [jenis, setJenis] = useState<JenisMasukan | null>(null);
    const [isi, setIsi] = useState("");
    // Panel baru dirender setelah diklik, jadi membaca localStorage di sini tidak membuat hidrasi berbeda.
    const [nama, setNama] = useState(() => {
        try {
            return (typeof localStorage !== "undefined" && localStorage.getItem(KUNCI_NAMA)) || "Faldy";
        } catch {
            return "Faldy";
        }
    });
    const [gambar, setGambar] = useState<File | null>(null);
    const [status, setStatus] = useState<"diam" | "kirim" | "terkirim">("diam");
    const [galat, setGalat] = useState<string | null>(null);
    const [terkirim, setTerkirim] = useState(0);
    const panel = useRef<HTMLDivElement>(null);
    const tombol = useRef<HTMLButtonElement>(null);
    const id = useId();

    useEffect(() => {
        if (!buka) return;
        const esc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setBuka(false);
                tombol.current?.focus();
            }
        };
        window.addEventListener("keydown", esc);
        panel.current?.querySelector<HTMLElement>("input[type=radio]")?.focus();
        return () => window.removeEventListener("keydown", esc);
    }, [buka]);

    async function kirim(e: React.FormEvent) {
        e.preventDefault();
        if (!jenis) return setGalat("Pilih jenisnya dulu: Bug, Aneh, Tanya, atau Saran.");
        if (isi.trim().length < 3) return setGalat("Tulis masukannya dulu, minimal beberapa kata.");
        setGalat(null);
        setStatus("kirim");
        try {
            const fd = new FormData();
            fd.set("nama", nama.trim() || "Faldy");
            fd.set("jenis", jenis);
            fd.set("konteks", konteks.slice(0, 160));
            fd.set("langkah", langkah.slice(0, 64));
            fd.set("isi", isi);
            if (gambar) fd.set("gambar", await perkecil(gambar), "tangkapan.jpg");
            const r = await fetch("/api/masukan", { method: "POST", body: fd });
            if (!r.ok) {
                const j = (await r.json().catch(() => null)) as { pesan?: string } | null;
                throw new Error(j?.pesan ?? "Gagal mengirim. Coba lagi.");
            }
            try {
                localStorage.setItem(KUNCI_NAMA, nama.trim() || "Faldy");
            } catch {}
            setTerkirim((n) => n + 1);
            setStatus("terkirim");
            setIsi("");
            setGambar(null);
            setJenis(null);
        } catch (err) {
            setStatus("diam");
            setGalat(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Tidak tersambung. Periksa internet lalu kirim lagi.");
        }
    }

    return (
        <>
            <button
                ref={tombol}
                type="button"
                className="pd-fab"
                aria-expanded={buka}
                aria-controls={`${id}-panel`}
                onClick={() => {
                    setBuka((b) => !b);
                    if (status === "terkirim") setStatus("diam");
                }}
            >
                <MessageSquareText className="size-5" aria-hidden />
                <span>Masukan</span>
                {terkirim > 0 && <span className="pd-fab-angka" aria-label={`${terkirim} terkirim`}>{terkirim}</span>}
            </button>
            {buka && (
                <div ref={panel} id={`${id}-panel`} role="dialog" aria-modal="false" aria-labelledby={`${id}-judul`} className="pd-panel">
                    <div className="pd-panel-kepala">
                        <h2 id={`${id}-judul`}>Kirim masukan</h2>
                        <button type="button" className="pd-ikon" onClick={() => setBuka(false)} aria-label="Tutup panel masukan">
                            <X className="size-5" aria-hidden />
                        </button>
                    </div>
                    {status === "terkirim" ? (
                        <div className="pd-terkirim" role="status">
                            <p>
                                <b>Terkirim. Terima kasih!</b> Masukanmu sudah sampai ke pengembang bersama langkah asalnya.
                            </p>
                            <button type="button" className="pd-btn" onClick={() => setStatus("diam")}>
                                Kirim masukan lain
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={kirim} noValidate>
                            <p className="pd-konteks">
                                Tentang: <b>{konteks}</b>
                            </p>
                            <fieldset className="pd-jenis">
                                <legend>Jenis</legend>
                                {JENIS_MASUKAN.map((j) => (
                                    <label key={j}>
                                        <input type="radio" name="jenis" value={j} checked={jenis === j} onChange={() => setJenis(j)} />
                                        <span>{j === "aneh" ? "Aneh" : j === "tanya" ? "Tanya" : LABEL_JENIS_MASUKAN[j]}</span>
                                    </label>
                                ))}
                            </fieldset>
                            <label className="pd-bidang">
                                <span>Ceritakan</span>
                                <textarea
                                    value={isi}
                                    maxLength={MAKS_ISI}
                                    rows={4}
                                    onChange={(e) => setIsi(e.target.value)}
                                    placeholder="Tulis saja seperti chat: apa yang terjadi, apa yang kamu harapkan."
                                    aria-invalid={!!galat && isi.trim().length < 3}
                                />
                            </label>
                            <label className="pd-unggah">
                                <ImagePlus className="size-4" aria-hidden />
                                <span>{gambar ? gambar.name : "Tambah tangkapan layar (opsional)"}</span>
                                <input type="file" accept="image/*" className="sr-only" onChange={(e) => setGambar(e.target.files?.[0] ?? null)} />
                            </label>
                            <label className="pd-bidang">
                                <span>Nama</span>
                                <input value={nama} maxLength={80} onChange={(e) => setNama(e.target.value)} autoComplete="name" />
                            </label>
                            {galat && (
                                <p className="pd-galat" role="alert">
                                    {galat}
                                </p>
                            )}
                            <button type="submit" className="pd-btn pd-btn-utama w-full" disabled={status === "kirim"}>
                                <Send className="size-4" aria-hidden /> {status === "kirim" ? "Mengirim…" : "Kirim"}
                            </button>
                        </form>
                    )}
                </div>
            )}
        </>
    );
}
