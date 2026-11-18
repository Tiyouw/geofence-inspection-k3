"use client";

/**
 * Penyaring lembar stiker QR: berlaku seketika (tanpa tombol "Terapkan"), lewat query string supaya
 * tautan bisa dibagikan dan tombol Kembali bekerja. Kode aset diketik sebagai keping (Enter, koma,
 * atau tempel daftar "01D, 14A").
 */
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Pilihan } from "@/components/ui/pilihan";
import { cn } from "@/lib/utils";
import { IlustrasiModul, modulDari } from "@/components/ilustrasi/modul";
import { parseDaftarKode, qsStiker, TATA_LETAK, type KodeTata, type SaringStiker } from "../lib/stiker";

type Props = {
    tata: KodeTata;
    nilai: SaringStiker;
    pilihan: {
        tata: { kode: KodeTata; nama: string }[];
        tipe: { slug: string; nama: string }[];
        area: { id: number; nama: string }[];
        lantai: string[];
        belumBerarea: number;
    };
    /** Ringkasan jumlah stiker dan lembar (dari peladen), tampil di bawah pilihan tata letak. */
    ringkasan?: ReactNode;
};

const LABEL = "flex min-w-0 flex-col gap-1.5 text-xs font-semibold";
/** Kontrol setinggi 44 px (sasaran sentuh), sama dengan saringan Aset arah A. */
const KONTROL = "h-11";

export function SaringStiker({ tata: tataAwal, nilai: awal, pilihan, ringkasan }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [menunggu, mulai] = useTransition();
    const [tata, setTata] = useState(tataAwal);
    const [f, setF] = useState(awal);
    const [ketik, setKetik] = useState("");

    function terapkan(tataBaru: KodeTata, baru: SaringStiker) {
        setTata(tataBaru);
        setF(baru);
        mulai(() => router.replace(`${pathname}${qsStiker(tataBaru, baru)}`, { scroll: false }));
    }
    const ubah = (sebagian: Partial<SaringStiker>) => terapkan(tata, { ...f, ...sebagian });

    function tambahKode(teks: string) {
        const baru = parseDaftarKode(teks).filter((k) => !f.kode.includes(k));
        setKetik("");
        if (baru.length) ubah({ kode: [...f.kode, ...baru].slice(0, 200) });
    }
    function tombolKode(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            tambahKode(ketik);
        } else if (e.key === "Backspace" && !ketik && f.kode.length) {
            ubah({ kode: f.kode.slice(0, -1) });
        }
    }

    const aktif = f.tipe.length > 0 || f.area !== undefined || !!f.lantai || f.kode.length > 0;

    return (
        <section
            aria-label="Saring stiker"
            aria-busy={menunggu}
            className="stiker-layar mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start"
        >
            <div className="rounded-kartu border bg-card p-4 sm:p-5">
                <Langkah nomor={1} judul="Pilih aset" kanan={
                    (aktif || menunggu) &&
                    (menunggu ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
                            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Memuat…
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={() => terapkan(tata, { tipe: [], kode: [] })}
                            className="inline-flex min-h-8 items-center gap-1 rounded-kontrol px-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                            <X className="size-3.5" aria-hidden /> Hapus saringan
                        </button>
                    ))
                } />

                <fieldset className="mt-4">
                    <legend className="mb-2 text-xs font-semibold">Jenis peralatan</legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                        {pilihan.tipe.map((t) => {
                            const centang = f.tipe.includes(t.slug);
                            return (
                                <label
                                    key={t.slug}
                                    className={cn(
                                        "relative flex min-h-14 cursor-pointer items-center gap-2 rounded-kontrol border p-2 pr-8 text-sm font-semibold transition-colors duration-(--durasi) ease-halus select-none",
                                        "hover:border-foreground/30 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                                        centang ? "border-primary bg-peran-utama-rona text-foreground" : "bg-background text-foreground/80",
                                    )}
                                >
                                    <IlustrasiModul modul={modulDari(t.slug)} ukuran={36} />
                                    <span className="min-w-0 leading-tight">{t.nama}</span>
                                    <Checkbox
                                        className="absolute top-2 right-2"
                                        checked={centang}
                                        onCheckedChange={(c) =>
                                            ubah({
                                                tipe: c
                                                    ? pilihan.tipe.map((x) => x.slug).filter((s) => s === t.slug || f.tipe.includes(s))
                                                    : f.tipe.filter((s) => s !== t.slug),
                                            })
                                        }
                                    />
                                </label>
                            );
                        })}
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">Tanpa centang berarti semua jenis.</p>
                </fieldset>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className={LABEL}>
                        Area
                        <Pilihan
                            name="area"
                            value={f.area === undefined ? "" : String(f.area)}
                            className={KONTROL}
                            onValueChange={(v) => ubah({ area: v === "" ? undefined : v === "belum" ? "belum" : Number(v) })}
                        >
                            <option value="">Semua area</option>
                            {pilihan.area.map((a) => (
                                <option key={a.id} value={String(a.id)}>
                                    {a.nama}
                                </option>
                            ))}
                            <option value="belum">{`Belum berarea (${pilihan.belumBerarea})`}</option>
                        </Pilihan>
                    </label>
                    <label className={LABEL}>
                        Lantai
                        <Pilihan name="lantai" value={f.lantai ?? ""} className={KONTROL} onValueChange={(v) => ubah({ lantai: v || undefined })}>
                            <option value="">Semua lantai</option>
                            {pilihan.lantai.map((l) => (
                                <option key={l} value={l}>
                                    {l}
                                </option>
                            ))}
                        </Pilihan>
                    </label>
                </div>

                <div className="mt-4">
                    <label htmlFor="stiker-kode" className="mb-1.5 block text-xs font-semibold">
                        Kode aset tertentu
                        <span className="ml-1 font-normal text-muted-foreground">(Enter atau koma untuk menambah)</span>
                    </label>
                    <div
                        className={cn(
                            "flex min-h-11 flex-wrap items-center gap-1.5 rounded-kontrol border border-input bg-background px-2 py-1",
                            "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                        )}
                    >
                        {f.kode.map((k) => (
                            <span
                                key={k}
                                data-testid="keping-kode"
                                className="inline-flex h-7 items-center gap-1 rounded-md bg-peran-utama-rona pr-1 pl-2 font-mono text-xs font-semibold text-peran-utama-tua"
                            >
                                {k}
                                <button
                                    type="button"
                                    aria-label={`Hapus kode ${k}`}
                                    onClick={() => ubah({ kode: f.kode.filter((x) => x !== k) })}
                                    className="grid size-6 place-items-center rounded hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                                >
                                    <X className="size-3" aria-hidden />
                                </button>
                            </span>
                        ))}
                        <input
                            id="stiker-kode"
                            value={ketik}
                            onChange={(e) => {
                                const v = e.target.value;
                                if (v.includes(",")) tambahKode(v);
                                else setKetik(v);
                            }}
                            onKeyDown={tombolKode}
                            onBlur={() => ketik.trim() && tambahKode(ketik)}
                            placeholder={f.kode.length ? "" : "mis. 01D, 14A"}
                            autoComplete="off"
                            enterKeyHint="done"
                            className="h-8 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="rounded-kartu border bg-card p-4 sm:p-5">
                    <Langkah nomor={2} judul="Tata letak label" />
                    <div role="radiogroup" aria-label="Tata letak label" className="mt-3 grid grid-cols-3 gap-2 lg:grid-cols-1">
                        {pilihan.tata.map((t) => {
                            const d = TATA_LETAK[t.kode];
                            const pilih = tata === t.kode;
                            return (
                                <button
                                    key={t.kode}
                                    type="button"
                                    role="radio"
                                    aria-checked={pilih}
                                    onClick={() => terapkan(t.kode, f)}
                                    className={cn(
                                        "flex min-h-14 flex-col items-center gap-2 rounded-kontrol border p-2 text-center transition-colors duration-(--durasi) lg:flex-row lg:text-left",
                                        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                                        pilih ? "border-primary bg-peran-utama-rona" : "bg-background hover:border-foreground/30",
                                    )}
                                >
                                    <MiniLembar kolom={d.kolom} baris={d.baris} aktif={pilih} />
                                    <span className="min-w-0">
                                        <b className="block text-sm">{d.kolom * d.baris} label</b>
                                        <span className="block text-xs text-muted-foreground tabular-nums">
                                            {String(d.lebar).replace(".", ",")} x {String(d.tinggi).replace(".", ",")} mm
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                {ringkasan}
            </div>
        </section>
    );
}

/** Judul langkah bernomor (arah A): lingkaran nomor, judul, aksi kecil di kanan. */
function Langkah({ nomor, judul, kanan }: { nomor: number; judul: string; kanan?: React.ReactNode }) {
    return (
        <div className="flex min-h-8 items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-base font-bold">
                <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground tabular-nums" aria-hidden>
                    {nomor}
                </span>
                {judul}
            </h2>
            {kanan}
        </div>
    );
}

/** Gambar kecil satu lembar A4 dengan kisi label, untuk memilih tata letak. */
function MiniLembar({ kolom, baris, aktif }: { kolom: number; baris: number; aktif: boolean }) {
    const W = 30;
    const H = 42;
    const lw = (W - 4) / kolom;
    const lh = (H - 4) / baris;
    return (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden className="shrink-0">
            <rect x=".5" y=".5" width={W - 1} height={H - 1} rx="2" className="fill-background stroke-border" />
            {Array.from({ length: kolom * baris }, (_, i) => (
                <rect
                    key={i}
                    x={2 + (i % kolom) * lw + 0.4}
                    y={2 + Math.floor(i / kolom) * lh + 0.4}
                    width={lw - 0.8}
                    height={lh - 0.8}
                    rx=".6"
                    className={aktif ? "fill-primary/70" : "fill-muted-foreground/35"}
                />
            ))}
        </svg>
    );
}
