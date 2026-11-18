"use client";

/**
 * Penyaring lembar stiker QR: berlaku seketika (tanpa tombol "Terapkan"), lewat query string supaya
 * tautan bisa dibagikan dan tombol Kembali bekerja. Kode aset diketik sebagai keping (Enter, koma,
 * atau tempel daftar "01D, 14A").
 */
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition, type KeyboardEvent } from "react";
import { Loader2, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Pilihan } from "@/components/ui/pilihan";
import { cn } from "@/lib/utils";
import { parseDaftarKode, qsStiker, type KodeTata, type SaringStiker } from "../lib/stiker";
import { IkonModul } from "./ikon-modul";

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
};

const LABEL = "flex min-w-0 flex-col gap-1.5 text-xs font-medium";
/** Kontrol setinggi 40 px di ponsel (sasaran sentuh), 32 px di layar lebar seperti halaman admin lain. */
const KONTROL = "h-10 sm:h-8";

export function SaringStiker({ tata: tataAwal, nilai: awal, pilihan }: Props) {
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
            className="stiker-layar mb-5 rounded-xl border bg-card p-4 shadow-xs sm:p-5"
        >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className={LABEL}>
                    Tata letak label
                    <Pilihan
                        name="tata"
                        value={tata}
                        className={KONTROL}
                        onValueChange={(v) => terapkan(v as KodeTata, f)}
                    >
                        {pilihan.tata.map((t) => (
                            <option key={t.kode} value={t.kode}>
                                {t.nama}
                            </option>
                        ))}
                    </Pilihan>
                </label>
                <label className={LABEL}>
                    Area
                    <Pilihan
                        name="area"
                        value={f.area === undefined ? "" : String(f.area)}
                        className={KONTROL}
                        onValueChange={(v) =>
                            ubah({ area: v === "" ? undefined : v === "belum" ? "belum" : Number(v) })
                        }
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
                    <Pilihan
                        name="lantai"
                        value={f.lantai ?? ""}
                        className={KONTROL}
                        onValueChange={(v) => ubah({ lantai: v || undefined })}
                    >
                        <option value="">Semua lantai</option>
                        {pilihan.lantai.map((l) => (
                            <option key={l} value={l}>
                                {l}
                            </option>
                        ))}
                    </Pilihan>
                </label>
            </div>

            <fieldset className="mt-4">
                <legend className="mb-1.5 text-xs font-medium">Jenis objek</legend>
                <div className="flex flex-wrap gap-2">
                    {pilihan.tipe.map((t) => {
                        const centang = f.tipe.includes(t.slug);
                        return (
                            <label
                                key={t.slug}
                                className={cn(
                                    "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors duration-(--durasi) ease-halus select-none sm:min-h-8",
                                    "hover:border-foreground/25 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                                    centang ? "border-primary bg-primary/5 text-foreground" : "bg-background text-muted-foreground",
                                )}
                            >
                                <Checkbox
                                    checked={centang}
                                    onCheckedChange={(c) =>
                                        ubah({
                                            tipe: c
                                                ? pilihan.tipe.map((x) => x.slug).filter((s) => s === t.slug || f.tipe.includes(s))
                                                : f.tipe.filter((s) => s !== t.slug),
                                        })
                                    }
                                />
                                <IkonModul slug={t.slug} className="size-4" />
                                {t.nama}
                            </label>
                        );
                    })}
                </div>
            </fieldset>

            <div className="mt-4">
                <label htmlFor="stiker-kode" className="mb-1.5 block text-xs font-medium">
                    Kode aset tertentu
                    <span className="ml-1 font-normal text-muted-foreground">(Enter atau koma untuk menambah)</span>
                </label>
                <div
                    className={cn(
                        "flex min-h-10 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1 sm:min-h-8",
                        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                    )}
                >
                    {f.kode.map((k) => (
                        <span
                            key={k}
                            data-testid="keping-kode"
                            className="inline-flex h-7 items-center gap-1 rounded-md bg-secondary pr-1 pl-2 font-mono text-xs font-semibold text-secondary-foreground sm:h-6"
                        >
                            {k}
                            <button
                                type="button"
                                aria-label={`Hapus kode ${k}`}
                                onClick={() => ubah({ kode: f.kode.filter((x) => x !== k) })}
                                className="grid size-6 place-items-center rounded hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:size-5"
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
                        className="h-8 min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground sm:h-6"
                    />
                </div>
            </div>

            {(aktif || menunggu) && (
                <div className="mt-3 flex min-h-6 items-center gap-3 text-xs">
                    {menunggu ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground" role="status">
                            <Loader2 className="size-3.5 animate-spin" aria-hidden /> Memuat…
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={() => terapkan(tata, { tipe: [], kode: [] })}
                            className="inline-flex items-center gap-1 rounded font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                            <X className="size-3.5" aria-hidden /> Hapus saringan
                        </button>
                    )}
                </div>
            )}
        </section>
    );
}
