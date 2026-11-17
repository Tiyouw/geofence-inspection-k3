"use client";

import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "@/components/shell/brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { adaIsi } from "./markdown";
import type { Bagian, JawabanAda, Lampiran, Pertanyaan } from "./types";

type Status = "diam" | "menyimpan" | "tersimpan" | "gagal";
const JEDA_SIMPAN = 800;
const MAKS_BYTES = 10 * 1024 * 1024;

const kosong = (): JawabanAda => ({
    jawaban: "",
    pilihan: null,
    pakaiBawaan: false,
    perluTanya: false,
    lampiran: [],
    diubahPada: null,
});

type Props = {
    token: string;
    formulir: string;
    bagian: Bagian[];
    pertanyaan: Pertanyaan[];
    caraMenjawab: string[];
    bahan: string[];
    awal: Record<string, JawabanAda>;
    dikirimPadaAwal: string | null;
    unggahLangsung: boolean;
};

function waktu(iso: string) {
    return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}

function ukuran(b: number) {
    return b >= 1048576
        ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB`
        : `${Math.max(1, Math.round(b / 1024))} KB`;
}

export function FormTanya(props: Props) {
    const { token, bagian, pertanyaan } = props;
    const [jawaban, setJawaban] = useState<Record<string, JawabanAda>>(props.awal);
    const [status, setStatus] = useState<Record<string, Status>>({});
    const [tab, setTab] = useState<string>("wajib");
    const [dikirimPada, setDikirimPada] = useState<string | null>(props.dikirimPadaAwal);
    const [mengirim, setMengirim] = useState(false);
    const [pesanKirim, setPesanKirim] = useState<string | null>(null);

    // Antrean simpan per nomor: jeda, lalu kirim nilai TERBARU (bukan nilai saat diketik).
    const terbaru = useRef(jawaban);
    const timer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const tertunda = useRef(new Set<string>());
    const berjalan = useRef<Record<string, Promise<void> | undefined>>({});

    const kirimSatu = useCallback(
        async (nomor: string, keepalive = false) => {
            tertunda.current.delete(nomor);
            const j = terbaru.current[nomor] ?? kosong();
            setStatus((s) => ({ ...s, [nomor]: "menyimpan" }));
            try {
                const res = await fetch(`/api/tanya/${token}/jawaban`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    keepalive,
                    body: JSON.stringify({
                        nomor,
                        jawaban: j.jawaban,
                        pilihan: j.pilihan,
                        pakaiBawaan: j.pakaiBawaan,
                        perluTanya: j.perluTanya,
                    }),
                });
                if (!res.ok) throw new Error();
                // Perubahan baru masuk saat menyimpan: biarkan antrean berikutnya yang menandai tersimpan.
                if (!tertunda.current.has(nomor)) setStatus((s) => ({ ...s, [nomor]: "tersimpan" }));
            } catch {
                tertunda.current.add(nomor);
                setStatus((s) => ({ ...s, [nomor]: "gagal" }));
            }
        },
        [token],
    );

    const simpan = useCallback(
        (nomor: string) => {
            tertunda.current.add(nomor);
            clearTimeout(timer.current[nomor]);
            setStatus((s) => ({ ...s, [nomor]: "menyimpan" }));
            timer.current[nomor] = setTimeout(() => {
                const sebelumnya = berjalan.current[nomor] ?? Promise.resolve();
                berjalan.current[nomor] = sebelumnya.then(() => kirimSatu(nomor));
            }, JEDA_SIMPAN);
        },
        [kirimSatu],
    );

    const flushSemua = useCallback(
        async (keepalive = false) => {
            const daftar = [...tertunda.current];
            for (const n of daftar) clearTimeout(timer.current[n]);
            await Promise.all(Object.values(berjalan.current));
            await Promise.all(daftar.map((n) => kirimSatu(n, keepalive)));
        },
        [kirimSatu],
    );

    // Simpan sisa ketikan saat tab ditutup atau aplikasi ditinggal (ponsel).
    useEffect(() => {
        const tinggal = () => {
            if (document.visibilityState === "hidden" && tertunda.current.size) void flushSemua(true);
        };
        const tutup = (e: BeforeUnloadEvent) => {
            if (tertunda.current.size) {
                void flushSemua(true);
                e.preventDefault();
            }
        };
        document.addEventListener("visibilitychange", tinggal);
        window.addEventListener("beforeunload", tutup);
        return () => {
            document.removeEventListener("visibilitychange", tinggal);
            window.removeEventListener("beforeunload", tutup);
        };
    }, [flushSemua]);

    const ubah = useCallback(
        (nomor: string, sebagian: Partial<JawabanAda>) => {
            setJawaban((prev) => {
                const next = { ...prev, [nomor]: { ...(prev[nomor] ?? kosong()), ...sebagian } };
                terbaru.current = next;
                return next;
            });
            simpan(nomor);
        },
        [simpan],
    );

    const setLampiran = useCallback((nomor: string, fn: (l: Lampiran[]) => Lampiran[]) => {
        setJawaban((prev) => {
            const cur = prev[nomor] ?? kosong();
            const next = { ...prev, [nomor]: { ...cur, lampiran: fn(cur.lampiran) } };
            terbaru.current = next;
            return next;
        });
    }, []);

    const wajib = useMemo(() => pertanyaan.filter((p) => p.wajib), [pertanyaan]);
    const terisi = pertanyaan.filter((p) => adaIsi(jawaban[p.nomor])).length;
    const wajibTerisi = wajib.filter((p) => adaIsi(jawaban[p.nomor])).length;
    const persen = Math.round((terisi / pertanyaan.length) * 100);

    const tampil = tab === "wajib" ? wajib : pertanyaan.filter((p) => p.bagian === tab);
    const bagianAktif = bagian.find((b) => b.nomor === tab);

    const pilihTab = (t: string) => {
        setTab(t);
        document.getElementById("daftar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    async function kirimJawaban() {
        setMengirim(true);
        setPesanKirim(null);
        try {
            await flushSemua();
            if (tertunda.current.size)
                throw new Error("Sebagian jawaban belum tersimpan. Periksa koneksi, lalu coba lagi.");
            const res = await fetch(`/api/tanya/${token}/kirim`, { method: "POST" });
            if (!res.ok) throw new Error("Gagal mengirim. Coba lagi sebentar.");
            const d = (await res.json()) as { dikirimPada: string };
            setDikirimPada(d.dikirimPada);
            setPesanKirim("Terima kasih, jawaban sudah dikirim. Anda masih bisa mengubahnya kapan saja.");
        } catch (e) {
            setPesanKirim(e instanceof Error ? e.message : "Gagal mengirim.");
        } finally {
            setMengirim(false);
        }
    }

    return (
        <div className="min-h-dvh bg-muted pb-36">
            <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
                    <Brand />
                    <p className="text-right text-xs text-muted-foreground" aria-live="polite">
                        <span className="font-semibold text-foreground" data-testid="hitung-terisi">
                            {terisi}/{pertanyaan.length}
                        </span>{" "}
                        terjawab · WAJIB{" "}
                        <span className="font-semibold text-foreground" data-testid="hitung-wajib">
                            {wajibTerisi}/{wajib.length}
                        </span>
                    </p>
                </div>
                <div
                    className="h-1 w-full bg-border"
                    role="progressbar"
                    aria-label="Kemajuan menjawab"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={persen}
                >
                    <div
                        className="h-full bg-foreground/70 transition-[width] duration-700 ease-halus"
                        style={{ width: `${persen}%` }}
                    />
                </div>
            </header>

            <main className="mx-auto max-w-3xl px-4 pt-6">
                <h1 className="text-2xl font-semibold tracking-tight text-balance">Pertanyaan PAL-K3 untuk Rifaldy</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {pertanyaan.length} pertanyaan, {wajib.length} di antaranya WAJIB dijawab dulu. Jawaban tersimpan
                    otomatis, jadi Anda bisa berhenti kapan saja dan melanjutkan dari laptop atau ponsel.
                </p>

                <details className="group mt-5 rounded-xl border bg-card p-4 open:pb-5">
                    <summary className="cursor-pointer list-none text-sm font-semibold marker:hidden">
                        <span className="inline-block transition-transform duration-300 ease-halus group-open:rotate-90">
                            ›
                        </span>{" "}
                        Cara menjawab
                    </summary>
                    <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                        {props.caraMenjawab.map((c) => (
                            <li key={c}>{c}</li>
                        ))}
                        <li>
                            Tombol <b>Pakai bawaan</b> mengisi jawaban yang akan kami pakai bila Anda setuju. Centang{" "}
                            <b>perlu tanya pembimbing/perusahaan</b> bila Anda belum bisa memutuskan sendiri.
                        </li>
                    </ol>
                </details>

                <details className="group mt-3 rounded-xl border bg-card p-4 open:pb-5">
                    <summary className="cursor-pointer list-none text-sm font-semibold marker:hidden">
                        <span className="inline-block transition-transform duration-300 ease-halus group-open:rotate-90">
                            ›
                        </span>{" "}
                        Bahan yang perlu dibawa ({props.bahan.length})
                    </summary>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                        {props.bahan.map((b) => (
                            <li key={b} className="flex gap-2">
                                <span
                                    aria-hidden
                                    className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                                />
                                {b}
                            </li>
                        ))}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Unggah berkasnya pada pertanyaan yang bersangkutan (nomor di dalam kurung).
                    </p>
                </details>

                <nav
                    aria-label="Bagian pertanyaan"
                    className="sticky top-[61px] z-10 -mx-4 mt-6 overflow-x-auto bg-muted/95 px-4 py-2 backdrop-blur [scrollbar-width:none]"
                >
                    <div className="flex w-max gap-1.5" role="tablist">
                        {[
                            { id: "wajib", label: `WAJIB (${wajibTerisi}/${wajib.length})` },
                            ...bagian.map((b) => {
                                const isi = pertanyaan.filter((p) => p.bagian === b.nomor);
                                const sudah = isi.filter((p) => adaIsi(jawaban[p.nomor])).length;
                                return { id: b.nomor, label: `${b.nomor}. ${b.judul} (${sudah}/${isi.length})` };
                            }),
                        ].map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                role="tab"
                                aria-selected={tab === t.id}
                                onClick={() => pilihTab(t.id)}
                                className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors duration-300 ease-halus",
                                    tab === t.id
                                        ? "border-foreground bg-foreground text-background"
                                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                                )}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </nav>

                <section id="daftar" className="scroll-mt-28 pt-4" aria-live="polite">
                    <div key={tab} className="animate-muncul">
                        <p className="mb-4 text-sm text-muted-foreground">
                            {tab === "wajib"
                                ? "Jawab bagian ini lebih dulu. Tanpa 15 jawaban ini PRD belum bisa ditulis."
                                : bagianAktif?.ringkasan}
                        </p>
                        <div className="space-y-4">
                            {tampil.map((p) => (
                                <KartuPertanyaan
                                    key={p.nomor}
                                    p={p}
                                    judulBagian={
                                        tab === "wajib" ? bagian.find((b) => b.nomor === p.bagian)?.judul : undefined
                                    }
                                    j={jawaban[p.nomor] ?? kosong()}
                                    status={status[p.nomor] ?? "diam"}
                                    ubah={(s) => ubah(p.nomor, s)}
                                    coba={() => simpan(p.nomor)}
                                    token={token}
                                    formulir={props.formulir}
                                    unggahLangsung={props.unggahLangsung}
                                    setLampiran={(fn) => setLampiran(p.nomor, fn)}
                                />
                            ))}
                        </div>
                    </div>
                </section>
            </main>

            <footer className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
                <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="status-kirim">
                        {pesanKirim ??
                            (dikirimPada
                                ? `Dikirim ${waktu(dikirimPada)}. Perubahan setelahnya tetap tersimpan otomatis.`
                                : `${terisi} dari ${pertanyaan.length} terjawab. Kirim bila sudah selesai; Anda tetap bisa mengubah sesudahnya.`)}
                    </p>
                    <Button variant="brand" size="lg" className="h-11 px-5" onClick={kirimJawaban} disabled={mengirim}>
                        {mengirim ? "Mengirim…" : dikirimPada ? "Kirim ulang jawaban" : "Kirim jawaban"}
                    </Button>
                </div>
            </footer>
        </div>
    );
}

function IndikatorSimpan({ status, coba }: { status: Status; coba: () => void }) {
    const teks = { diam: "", menyimpan: "Menyimpan…", tersimpan: "Tersimpan", gagal: "Gagal menyimpan." }[status];
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 text-xs transition-opacity duration-500 ease-halus",
                status === "diam" ? "opacity-0" : "opacity-100",
                status === "gagal" ? "text-destructive" : "text-muted-foreground",
            )}
            role="status"
            data-status={status}
        >
            <span
                aria-hidden
                className={cn(
                    "size-1.5 rounded-full transition-colors duration-500",
                    status === "tersimpan"
                        ? "bg-success"
                        : status === "gagal"
                          ? "bg-destructive"
                          : "bg-muted-foreground/50 animate-pulse",
                )}
            />
            {teks}
            {status === "gagal" && (
                <button type="button" className="underline underline-offset-2" onClick={coba}>
                    Coba lagi
                </button>
            )}
        </span>
    );
}

function KartuPertanyaan(props: {
    p: Pertanyaan;
    judulBagian?: string;
    j: JawabanAda;
    status: Status;
    ubah: (s: Partial<JawabanAda>) => void;
    coba: () => void;
    token: string;
    formulir: string;
    unggahLangsung: boolean;
    setLampiran: (fn: (l: Lampiran[]) => Lampiran[]) => void;
}) {
    const { p, j } = props;
    const [mengunggah, setMengunggah] = useState(false);
    const [pesanBerkas, setPesanBerkas] = useState<string | null>(null);
    const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();
    const idTeks = `jawaban-${p.nomor}`;

    async function unggah(files: FileList | null) {
        if (!files?.length) return;
        setPesanBerkas(null);
        setMengunggah(true);
        try {
            for (const f of Array.from(files)) {
                if (f.size > MAKS_BYTES) throw new Error(`${f.name} lebih dari 10 MB.`);
                let hasil: Response;
                if (props.unggahLangsung) {
                    const aman =
                        f.name
                            .normalize("NFKD")
                            .replace(/[^\w.\-]+/g, "_")
                            .slice(-80) || "berkas";
                    const blob = await upload(`tanya/${props.formulir}/${p.nomor}/${aman}`, f, {
                        access: "private",
                        handleUploadUrl: `/api/tanya/${props.token}/unggah`,
                        clientPayload: p.nomor,
                        multipart: f.size > 4 * 1024 * 1024,
                    });
                    hasil = await fetch(`/api/tanya/${props.token}/lampiran`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ nomor: p.nomor, pathname: blob.pathname, nama: f.name }),
                    });
                } else {
                    const fd = new FormData();
                    fd.set("nomor", p.nomor);
                    fd.set("berkas", f);
                    hasil = await fetch(`/api/tanya/${props.token}/lampiran`, { method: "POST", body: fd });
                }
                if (!hasil.ok)
                    throw new Error(
                        ((await hasil.json().catch(() => ({}))) as { pesan?: string }).pesan ?? "Unggahan gagal.",
                    );
                const l = (await hasil.json()) as Lampiran;
                props.setLampiran((daftar) => [...daftar, l]);
            }
            setPesanBerkas("Berkas tersimpan.");
        } catch (e) {
            setPesanBerkas(e instanceof Error ? e.message : "Unggahan gagal.");
        } finally {
            setMengunggah(false);
        }
    }

    async function hapus(id: string) {
        const res = await fetch(`/api/tanya/${props.token}/lampiran/${id}`, { method: "DELETE" });
        if (res.ok) props.setLampiran((d) => d.filter((x) => x.id !== id));
        else setPesanBerkas("Berkas gagal dihapus.");
    }

    return (
        <article
            id={`q-${p.nomor}`}
            data-nomor={p.nomor}
            className="rounded-xl border bg-card p-4 shadow-xs transition-shadow duration-300 ease-halus focus-within:shadow-md sm:p-5"
        >
            <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">{p.nomor}</span>
                {p.wajib && (
                    <span className="rounded-md border border-foreground/20 px-1.5 py-0.5 text-[0.65rem] font-semibold tracking-wide">
                        WAJIB
                    </span>
                )}
                {props.judulBagian && <span className="text-xs text-muted-foreground">{props.judulBagian}</span>}
                <span className="ml-auto">
                    <IndikatorSimpan status={props.status} coba={props.coba} />
                </span>
            </div>

            <label htmlFor={idTeks} className="block text-[0.95rem] leading-relaxed font-medium text-pretty">
                {p.teks}
            </label>

            <details className="group mt-2 text-sm text-muted-foreground">
                <summary className="cursor-pointer list-none text-xs font-medium marker:hidden hover:text-foreground">
                    <span className="inline-block transition-transform duration-300 ease-halus group-open:rotate-90">
                        ›
                    </span>{" "}
                    Kenapa penting dan apa yang terhambat
                </summary>
                <div className="mt-2 space-y-2 border-l-2 pl-3">
                    <p>{p.kenapa}</p>
                    <p>
                        <span className="font-medium text-foreground">Memblokir:</span> {p.memblokir}
                    </p>
                </div>
            </details>

            {p.pilihan.length > 0 ? (
                <fieldset className="mt-4">
                    <legend className="mb-2 text-xs font-medium text-muted-foreground">
                        Pilih salah satu (boleh ditambah penjelasan)
                    </legend>
                    <div className="grid gap-2">
                        {p.pilihan.map((o) => {
                            const aktif = j.pilihan === o.kode;
                            return (
                                <button
                                    key={o.kode}
                                    type="button"
                                    aria-pressed={aktif}
                                    onClick={() => props.ubah({ pilihan: aktif ? null : o.kode })}
                                    className={cn(
                                        "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors duration-300 ease-halus",
                                        aktif ? "border-foreground bg-foreground/5" : "border-border hover:bg-muted",
                                    )}
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border transition-colors duration-300",
                                            aktif ? "border-foreground" : "border-muted-foreground/40",
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "size-2 rounded-full bg-foreground transition-transform duration-300 ease-halus",
                                                aktif ? "scale-100" : "scale-0",
                                            )}
                                        />
                                    </span>
                                    <span>
                                        <span className="font-mono text-xs text-muted-foreground">{o.kode})</span>{" "}
                                        {o.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </fieldset>
            ) : (
                p.pilihanTeks && <p className="mt-3 text-xs text-muted-foreground">Petunjuk: {p.pilihanTeks}</p>
            )}

            <Textarea
                id={idTeks}
                className="mt-4 min-h-24 bg-background"
                placeholder="Tulis jawaban Anda…"
                value={j.jawaban}
                maxLength={20000}
                onChange={(e) =>
                    props.ubah({ jawaban: e.target.value, pakaiBawaan: j.pakaiBawaan && e.target.value === p.bawaan })
                }
            />

            <div className="mt-3 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Kalau tidak dijawab, kami pakai:</span> {p.bawaan}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={j.pakaiBawaan}
                    onClick={() =>
                        props.ubah(
                            j.pakaiBawaan
                                ? { pakaiBawaan: false }
                                : { pakaiBawaan: true, jawaban: j.jawaban.trim() ? j.jawaban : p.bawaan },
                        )
                    }
                >
                    {j.pakaiBawaan ? "Memakai bawaan" : "Pakai bawaan"}
                </Button>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={j.perluTanya} onCheckedChange={(v) => props.ubah({ perluTanya: v === true })} />
                    perlu tanya pembimbing/perusahaan
                </label>
                <label
                    className={cn(
                        "ml-auto inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground",
                        mengunggah && "pointer-events-none opacity-60",
                    )}
                >
                    <input
                        type="file"
                        multiple
                        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
                        className="sr-only"
                        onChange={(e) => {
                            void unggah(e.target.files);
                            e.target.value = "";
                        }}
                        aria-label={`Lampirkan berkas untuk pertanyaan ${p.nomor}`}
                    />
                    {mengunggah ? "Mengunggah…" : "+ Lampirkan berkas/foto"}
                </label>
            </div>

            {(j.lampiran.length > 0 || pesanBerkas) && (
                <div className="mt-3 space-y-1.5">
                    {j.lampiran.map((l) => (
                        <div
                            key={l.id}
                            className="flex animate-muncul items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                        >
                            <a
                                href={`/api/tanya/${props.token}/lampiran/${l.id}`}
                                target="_blank"
                                rel="noopener"
                                className="min-w-0 flex-1 truncate underline-offset-2 hover:underline"
                            >
                                {l.nama}
                            </a>
                            <span className="text-muted-foreground">{ukuran(l.bytes)}</span>
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={async () => {
                                    const ya = await konfirmasi({ judul: `Hapus ${l.nama}?`, isi: "Berkas lampiran ini dihapus dari jawaban Anda.", tombol: "Hapus berkas", bahaya: true });
                                    if (ya) void hapus(l.id);
                                }}
                                aria-label={`Hapus ${l.nama}`}
                            >
                                Hapus
                            </button>
                        </div>
                    ))}
                    {pesanBerkas && <p className="text-xs text-muted-foreground">{pesanBerkas}</p>}
                </div>
            )}
            {dialogKonfirmasi}
        </article>
    );
}
