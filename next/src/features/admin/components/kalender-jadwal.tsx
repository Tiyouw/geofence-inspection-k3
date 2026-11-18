"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, GripVertical, MoveRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { IlustrasiModul, modulDari, warnaModul } from "@/components/ilustrasi/modul";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { Pilihan } from "@/components/ui/pilihan";
import { jatuhTempoUntuk } from "@/lib/domain/jadwal";
import { cn } from "@/lib/utils";
import { batalkanRencana, jadwalkanKelompok } from "../actions/kalender";

export type TipeKalender = { slug: string; nama: string; periodeHari: number };
export type RencanaKalender = {
    tanggal: string;
    tipeSlug: string;
    tipeNama: string;
    tempat: string;
    periode: string;
    jumlah: number;
    selesai: number;
};
export type BelumKalender = {
    tipeSlug: string;
    tipeNama: string;
    tempat: string;
    periode: string;
    jatuhTempo: string;
    jumlah: number;
};
type Kelompok = { tipeSlug: string; tipeNama: string; tempat: string; periode: string; jumlah: number };

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const HARI_PANJANG = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/* ---------- tanggal teks "YYYY-MM-DD" (tanpa zona) ---------- */
const keTanggal = (t: string) => new Date(`${t}T00:00:00Z`);
const keTeks = (d: Date) => d.toISOString().slice(0, 10);
const tambahHari = (t: string, n: number) => {
    const d = keTanggal(t);
    d.setUTCDate(d.getUTCDate() + n);
    return keTeks(d);
};
const indeksHari = (t: string) => (keTanggal(t).getUTCDay() + 6) % 7;
const awalMinggu = (t: string) => tambahHari(t, -indeksHari(t));
const tglPanjang = (t: string) => {
    const d = keTanggal(t);
    return `${HARI_PANJANG[indeksHari(t)]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const tglPendek = (t: string) => {
    const d = keTanggal(t);
    return `${d.getUTCDate()} ${BULAN[d.getUTCMonth()]!.slice(0, 3)}`;
};
const kunci = (k: Pick<Kelompok, "tipeSlug" | "tempat" | "periode">) => `${k.tipeSlug}|${k.tempat}|${k.periode}`;
const namaTempat = (t: string) => t || "Tanpa gedung";

function statusRencana(r: RencanaKalender, hariIni: string): { label: string; kelas: string } {
    if (r.selesai >= r.jumlah) return { label: "Selesai", kelas: "bg-success-soft text-success" };
    if (r.tanggal < hariIni) return { label: "Terlewat", kelas: "bg-danger-soft text-danger" };
    if (r.tanggal === hariIni) return { label: "Hari ini", kelas: "bg-info-soft text-info" };
    return { label: "Terjadwal", kelas: "bg-muted text-muted-foreground" };
}

type Dialognya =
    | { jenis: "hari"; tanggal: string }
    | { jenis: "rencana"; r: RencanaKalender }
    | { jenis: "belum"; b: BelumKalender }
    | null;

/**
 * Kalender jadwal pemeriksaan (arah A). Bulan atau minggu; klik tanggal untuk menjadwalkan, seret kartu
 * ke tanggal lain untuk memindahkan, seret dari "Belum dijadwalkan" untuk menjadwalkan. Setiap seretan
 * punya padanan papan ketik: tombol kartu membuka dialog dengan isian tanggal.
 */
export function KalenderJadwal({
    bulan,
    hariIni,
    lihat,
    jangkar,
    rencana,
    belum,
    tipe,
}: {
    /** "YYYY-MM-01" bulan yang ditampilkan. */
    bulan: string;
    hariIni: string;
    lihat: "bulan" | "minggu";
    /** Tanggal acuan tampilan minggu. */
    jangkar: string;
    rencana: RencanaKalender[];
    belum: BelumKalender[];
    tipe: TipeKalender[];
}) {
    const router = useRouter();
    const [sibuk, mulai] = useTransition();
    const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();
    const [tersembunyi, setTersembunyi] = useState<Set<string>>(new Set());
    const [diseret, setDiseretState] = useState<Kelompok | null>(null);
    // Ref juga: dragover pertama bisa datang sebelum state tersimpan.
    const diseretRef = useRef<Kelompok | null>(null);
    const setDiseret = (k: Kelompok | null) => {
        diseretRef.current = k;
        setDiseretState(k);
    };
    const [sasaran, setSasaran] = useState<string | null>(null);
    const [dialog, setDialog] = useState<Dialognya>(null);

    const periodeHari = useMemo(() => new Map(tipe.map((t) => [t.slug, t.periodeHari])), [tipe]);
    const tempoDari = (k: Pick<Kelompok, "tipeSlug" | "periode">) =>
        jatuhTempoUntuk(k.periode, periodeHari.get(k.tipeSlug) ?? 30);
    const tampil = (slug: string) => !tersembunyi.has(slug);

    const perHari = useMemo(() => {
        const m = new Map<string, RencanaKalender[]>();
        for (const r of rencana) {
            if (tersembunyi.has(r.tipeSlug)) continue;
            m.set(r.tanggal, [...(m.get(r.tanggal) ?? []), r]);
        }
        return m;
    }, [rencana, tersembunyi]);

    /* ---------- tanggal yang tampil ---------- */
    const hari: { t: string; luar: boolean }[] = useMemo(() => {
        if (lihat === "minggu") {
            const a = awalMinggu(jangkar);
            return Array.from({ length: 7 }, (_, i) => ({ t: tambahHari(a, i), luar: false }));
        }
        const a = awalMinggu(bulan);
        const akhirBulan = tambahHari(keTeks(new Date(Date.UTC(+bulan.slice(0, 4), +bulan.slice(5, 7), 1))), -1);
        const n = Math.ceil((indeksHari(bulan) + keTanggal(akhirBulan).getUTCDate()) / 7) * 7;
        return Array.from({ length: n }, (_, i) => {
            const t = tambahHari(a, i);
            return { t, luar: t.slice(0, 7) !== bulan.slice(0, 7) };
        });
    }, [lihat, jangkar, bulan]);

    /* ---------- navigasi lewat URL ---------- */
    const href = (b: string, l: "bulan" | "minggu", j?: string) => {
        const q = new URLSearchParams({ bulan: b.slice(0, 7) });
        if (l === "minggu") {
            q.set("lihat", "minggu");
            if (j) q.set("tgl", j);
        }
        return `/admin/jadwal?${q}`;
    };
    const geserBulan = (n: number) => {
        const d = keTanggal(bulan);
        d.setUTCMonth(d.getUTCMonth() + n, 1);
        return keTeks(d);
    };
    const sebelum =
        lihat === "bulan" ? href(geserBulan(-1), "bulan") : href(tambahHari(jangkar, -7).slice(0, 8) + "01", "minggu", tambahHari(jangkar, -7));
    const sesudah =
        lihat === "bulan" ? href(geserBulan(1), "bulan") : href(tambahHari(jangkar, 7).slice(0, 8) + "01", "minggu", tambahHari(jangkar, 7));
    const judul =
        lihat === "bulan"
            ? `${BULAN[keTanggal(bulan).getUTCMonth()]} ${bulan.slice(0, 4)}`
            : `${tglPendek(hari[0]!.t)} – ${tglPendek(hari[6]!.t)} ${hari[6]!.t.slice(0, 4)}`;

    /* ---------- aksi ---------- */
    function jalankan(aksi: typeof jadwalkanKelompok, data: Record<string, string>, selesai?: () => void) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(data)) fd.set(k, v);
        mulai(async () => {
            const r = await aksi(null, fd);
            if (r.ok) {
                toast.success(r.pesan ?? "Tersimpan.");
                selesai?.();
                router.refresh();
            } else toast.error(r.pesan);
        });
    }
    const jadwalkan = (k: Kelompok, tanggal: string, selesai?: () => void) =>
        jalankan(jadwalkanKelompok, { tipe: k.tipeSlug, tempat: k.tempat, periode: k.periode, tanggal }, selesai);
    const lepas = async (r: RencanaKalender) => {
        const ya = await konfirmasi({
            judul: "Lepas dari jadwal?",
            isi: `${r.tipeNama} di ${namaTempat(r.tempat)} kembali ke daftar "Belum dijadwalkan". Hasil pemeriksaan yang sudah ada tidak berubah.`,
            jumlah: `${r.jumlah - r.selesai} unit`,
            tombol: "Lepas",
        });
        if (ya)
            jalankan(batalkanRencana, { tipe: r.tipeSlug, tempat: r.tempat, periode: r.periode }, () => setDialog(null));
    };

    /* ---------- seret dan lepas ---------- */
    const mulaiSeret = (e: DragEvent, k: Kelompok) => {
        setDiseret(k);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", kunci(k));
    };
    const bolehDi = (k: Kelompok, t: string) => t >= k.periode && t <= tempoDari(k);
    const atasHari = (e: DragEvent, t: string) => {
        const k = diseretRef.current;
        if (!k) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = bolehDi(k, t) ? "move" : "none";
        setSasaran(t);
    };
    const jatuhkan = (e: DragEvent, t: string) => {
        e.preventDefault();
        const k = diseretRef.current;
        setDiseret(null);
        setSasaran(null);
        if (!k) return;
        if (!bolehDi(k, t)) {
            toast.error(`Tanggal harus di dalam periodenya: ${tglPendek(k.periode)} sampai ${tglPendek(tempoDari(k))}.`);
            return;
        }
        jadwalkan(k, t);
    };

    /* ---------- potongan tampilan ---------- */
    const kartu = (r: RencanaKalender, ringkas: boolean) => {
        const m = modulDari(r.tipeSlug);
        const s = statusRencana(r, hariIni);
        return (
            <button
                key={kunci(r)}
                type="button"
                draggable={r.selesai < r.jumlah}
                onDragStart={(e) => mulaiSeret(e, r)}
                onDragEnd={() => {
                    setDiseret(null);
                    setSasaran(null);
                }}
                onClick={() => setDialog({ jenis: "rencana", r })}
                aria-label={`${r.tipeNama}, ${namaTempat(r.tempat)}, ${r.jumlah} unit, ${s.label}. Buka untuk mengubah tanggal`}
                className={cn(
                    "flex w-full items-center gap-1.5 rounded-md text-left text-xs font-semibold leading-tight",
                    ringkas ? "px-1.5 py-1" : "flex-col items-start gap-0.5 border-l-4 px-2.5 py-2",
                    s.label === "Selesai" && "opacity-60",
                    r.selesai < r.jumlah && "cursor-grab active:cursor-grabbing",
                )}
                style={{ background: warnaModul(m).rona, borderColor: warnaModul(m).utama }}
            >
                {ringkas ? (
                    <>
                        <span aria-hidden className="mt-0.5 size-2 shrink-0 self-start rounded-sm" style={{ background: warnaModul(m).utama }} />
                        <span className={cn("min-w-0 flex-1", s.label === "Terlewat" && "line-through decoration-danger")}>
                            <span className="block truncate">{r.tipeNama}</span>
                            <span className="block truncate font-medium text-muted-foreground">{namaTempat(r.tempat)}</span>
                        </span>
                    </>
                ) : (
                    <>
                        <span className="text-[13px]">{r.tipeNama}</span>
                        <span className="font-medium">{namaTempat(r.tempat)}</span>
                        <span className="font-medium text-muted-foreground">
                            {r.selesai}/{r.jumlah} unit · {s.label}
                        </span>
                    </>
                )}
            </button>
        );
    };

    const sel = (t: string, luar: boolean, mingguan: boolean) => {
        const isi = perHari.get(t) ?? [];
        const maks = 3;
        const bisa = diseret ? bolehDi(diseret, t) : false;
        return (
            <div
                key={t}
                role="gridcell"
                aria-label={`${tglPanjang(t)}: ${isi.length ? `${isi.length} kelompok pemeriksaan` : "kosong"}`}
                onDragOver={(e) => atasHari(e, t)}
                onDragLeave={() => setSasaran((s) => (s === t ? null : s))}
                onDrop={(e) => jatuhkan(e, t)}
                className={cn(
                    "group relative flex min-w-0 flex-col gap-1 bg-card p-1.5",
                    mingguan ? "min-h-40 rounded-kartu border p-2.5 md:min-h-[420px]" : "min-h-14 md:min-h-28",
                    luar && "bg-peran-permukaan-2 text-muted-foreground",
                    t === hariIni && mingguan && "border-primary shadow-[inset_0_3px_0_var(--primary)]",
                    sasaran === t && (bisa ? "bg-accent outline-2 -outline-offset-4 outline-primary outline-dashed" : "bg-danger-soft"),
                )}
            >
                <div className="flex items-center justify-between gap-1">
                    <button
                        type="button"
                        onClick={() => setDialog({ jenis: "hari", tanggal: t })}
                        aria-label={`Buka ${tglPanjang(t)}`}
                        className={cn(
                            "grid size-7 place-items-center rounded-full text-[13px] font-bold hover:bg-muted",
                            t === hariIni && "bg-primary text-primary-foreground hover:bg-primary",
                        )}
                    >
                        {+t.slice(8)}
                    </button>
                    {mingguan && <span className="mr-auto text-xs font-semibold text-muted-foreground">{HARI[indeksHari(t)]}</span>}
                    <button
                        type="button"
                        onClick={() => setDialog({ jenis: "hari", tanggal: t })}
                        aria-label={`Jadwalkan di ${tglPanjang(t)}`}
                        className="hidden size-6 place-items-center rounded-md bg-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 md:grid"
                    >
                        <Plus className="size-3.5" aria-hidden />
                    </button>
                </div>
                {/* Ponsel tampilan bulan: titik warna saja; rincian lewat dialog hari. */}
                {!mingguan && isi.length > 0 && (
                    <span className="flex flex-wrap justify-center gap-0.5 md:hidden" aria-hidden>
                        {[...new Set(isi.map((r) => modulDari(r.tipeSlug)))].map((m) => (
                            <i key={m} className="size-1.5 rounded-full" style={{ background: warnaModul(m).utama }} />
                        ))}
                    </span>
                )}
                <div className={cn("flex flex-col gap-1", !mingguan && "max-md:hidden")}>
                    {(mingguan ? isi : isi.slice(0, maks)).map((r) => kartu(r, !mingguan))}
                    {!mingguan && isi.length > maks && (
                        <button
                            type="button"
                            onClick={() => setDialog({ jenis: "hari", tanggal: t })}
                            className="text-left text-xs font-semibold text-peran-utama-tua hover:underline"
                        >
                            +{isi.length - maks} lainnya
                        </button>
                    )}
                </div>
            </div>
        );
    };

    const terlihatBelum = belum.filter((b) => tampil(b.tipeSlug));

    return (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_340px]" aria-busy={sibuk}>
            <section aria-label="Kalender pemeriksaan" className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <div className="flex gap-1">
                        <Button asChild variant="outline" size="icon" aria-label={lihat === "bulan" ? "Bulan sebelumnya" : "Minggu sebelumnya"}>
                            <Link href={sebelum}>
                                <ChevronLeft aria-hidden />
                            </Link>
                        </Button>
                        <Button asChild variant="outline" size="icon" aria-label={lihat === "bulan" ? "Bulan berikutnya" : "Minggu berikutnya"}>
                            <Link href={sesudah}>
                                <ChevronRight aria-hidden />
                            </Link>
                        </Button>
                    </div>
                    <h2 className="min-w-0 text-lg font-bold sm:text-xl" aria-live="polite">
                        {judul}
                    </h2>
                    <Button asChild variant="outline" size="sm">
                        <Link href={href(hariIni.slice(0, 8) + "01", lihat, hariIni)}>Hari ini</Link>
                    </Button>
                    <div role="tablist" aria-label="Tampilan kalender" className="inline-flex rounded-kontrol bg-muted p-1 sm:ml-auto">
                        {(["bulan", "minggu"] as const).map((l) => (
                            <Link
                                key={l}
                                role="tab"
                                aria-selected={lihat === l}
                                href={href(bulan, l, lihat === "bulan" && l === "minggu" ? (bulan.slice(0, 7) === hariIni.slice(0, 7) ? hariIni : bulan) : jangkar)}
                                className="rounded-md px-3.5 py-1.5 text-sm font-semibold text-muted-foreground aria-selected:bg-card aria-selected:text-foreground aria-selected:shadow-sm"
                            >
                                {l === "bulan" ? "Bulan" : "Minggu"}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Tampilkan jenis peralatan">
                    {tipe.map((t) => {
                        const m = modulDari(t.slug);
                        const on = tampil(t.slug);
                        return (
                            <button
                                key={t.slug}
                                type="button"
                                aria-pressed={on}
                                onClick={() =>
                                    setTersembunyi((s) => {
                                        const n = new Set(s);
                                        if (on) n.add(t.slug);
                                        else n.delete(t.slug);
                                        return n;
                                    })
                                }
                                className={cn(
                                    "inline-flex min-h-9 items-center gap-2 rounded-full border bg-card px-3 text-[13px] font-semibold",
                                    !on && "text-muted-foreground line-through opacity-60",
                                )}
                            >
                                <i aria-hidden className="size-2.5 rounded-sm" style={{ background: warnaModul(m).utama }} />
                                {t.nama}
                            </button>
                        );
                    })}
                </div>

                {lihat === "bulan" ? (
                    <div role="grid" aria-label={judul} className="overflow-hidden rounded-kartu border bg-border">
                        <div role="row" className="grid grid-cols-7 gap-px">
                            {HARI.map((h) => (
                                <div
                                    key={h}
                                    role="columnheader"
                                    className="bg-peran-permukaan-2 px-2 py-2 text-center text-[11px] font-bold tracking-wide text-muted-foreground uppercase md:text-left"
                                >
                                    {h}
                                </div>
                            ))}
                        </div>
                        <div role="row" className="mt-px grid grid-cols-7 gap-px">
                            {hari.map((h) => sel(h.t, h.luar, false))}
                        </div>
                    </div>
                ) : (
                    <div role="grid" aria-label={judul}>
                        <div role="row" className="grid gap-2 md:grid-cols-7">
                            {hari.map((h) => sel(h.t, false, true))}
                        </div>
                    </div>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                    Seret kartu ke tanggal lain untuk memindahkan. Tanpa tetikus: klik kartu, lalu ubah tanggalnya.
                </p>
            </section>

            <aside aria-labelledby="judul-belum" className="flex min-w-0 flex-col gap-3">
                <div className="rounded-kartu border bg-card p-4">
                    <h2 id="judul-belum" className="flex items-center justify-between text-base font-bold">
                        Belum dijadwalkan
                        <span className="rounded-full bg-muted px-2 text-xs tabular-nums">{terlihatBelum.length}</span>
                    </h2>
                    <p className="mt-1 mb-3 text-xs text-muted-foreground">
                        Seret ke tanggal di kalender, atau pilih &quot;Jadwalkan&quot;.
                    </p>
                    {terlihatBelum.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-4 text-center text-sm text-muted-foreground">
                            <IlustrasiModul modul="apar" ukuran={72} />
                            Semua aset periode ini sudah punya tanggal.
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {terlihatBelum.map((b) => (
                                <li
                                    key={kunci(b)}
                                    draggable
                                    onDragStart={(e) => mulaiSeret(e, b)}
                                    onDragEnd={() => {
                                        setDiseret(null);
                                        setSasaran(null);
                                    }}
                                    className="flex cursor-grab items-center gap-2.5 rounded-kontrol border border-dashed bg-card p-2.5 active:cursor-grabbing"
                                >
                                    <GripVertical className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                                    <IlustrasiModul modul={modulDari(b.tipeSlug)} ukuran={36} />
                                    <span className="min-w-0 flex-1 leading-tight">
                                        <b className="block text-[13px] break-words">
                                            {b.tipeNama} · {namaTempat(b.tempat)}
                                        </b>
                                        <span className="text-xs text-muted-foreground">
                                            {b.jumlah} unit · s.d. {tglPendek(b.jatuhTempo)}
                                        </span>
                                    </span>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setDialog({ jenis: "belum", b })}
                                        aria-label={`Jadwalkan ${b.tipeNama} ${namaTempat(b.tempat)}`}
                                    >
                                        Jadwalkan
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </aside>

            <DialogHari
                dialog={dialog}
                tutup={() => setDialog(null)}
                hariIni={hariIni}
                perHari={perHari}
                belum={terlihatBelum}
                tempoDari={tempoDari}
                jadwalkan={jadwalkan}
                lepas={lepas}
                buka={(r) => setDialog({ jenis: "rencana", r })}
                sibuk={sibuk}
            />
            {dialogKonfirmasi}
        </div>
    );
}

function DialogHari({
    dialog,
    tutup,
    hariIni,
    perHari,
    belum,
    tempoDari,
    jadwalkan,
    lepas,
    buka,
    sibuk,
}: {
    dialog: Dialognya;
    tutup: () => void;
    hariIni: string;
    perHari: Map<string, RencanaKalender[]>;
    belum: BelumKalender[];
    tempoDari: (k: Pick<Kelompok, "tipeSlug" | "periode">) => string;
    jadwalkan: (k: Kelompok, tanggal: string, selesai?: () => void) => void;
    lepas: (r: RencanaKalender) => void;
    buka: (r: RencanaKalender) => void;
    sibuk: boolean;
}) {
    return (
        <Dialog open={dialog !== null} onOpenChange={(o) => !o && tutup()}>
            <DialogContent className="rounded-dialog sm:max-w-lg">
                {dialog?.jenis === "hari" && (
                    <IsiHari
                        key={dialog.tanggal}
                        tanggal={dialog.tanggal}
                        hariIni={hariIni}
                        rencana={perHari.get(dialog.tanggal) ?? []}
                        belum={belum.filter((b) => dialog.tanggal >= b.periode && dialog.tanggal <= b.jatuhTempo)}
                        jadwalkan={(k) => jadwalkan(k, dialog.tanggal, tutup)}
                        buka={buka}
                        tutup={tutup}
                        sibuk={sibuk}
                    />
                )}
                {(dialog?.jenis === "rencana" || dialog?.jenis === "belum") && (
                    <IsiUbahTanggal
                        key={dialog.jenis === "rencana" ? kunci(dialog.r) + dialog.r.tanggal : kunci(dialog.b)}
                        k={dialog.jenis === "rencana" ? dialog.r : dialog.b}
                        rencana={dialog.jenis === "rencana" ? dialog.r : null}
                        hariIni={hariIni}
                        tempo={tempoDari(dialog.jenis === "rencana" ? dialog.r : dialog.b)}
                        simpan={(t) => jadwalkan(dialog.jenis === "rencana" ? dialog.r : dialog.b, t, tutup)}
                        lepas={dialog.jenis === "rencana" ? () => lepas(dialog.r) : undefined}
                        tutup={tutup}
                        sibuk={sibuk}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

function IsiHari({
    tanggal,
    hariIni,
    rencana,
    belum,
    jadwalkan,
    buka,
    tutup,
    sibuk,
}: {
    tanggal: string;
    hariIni: string;
    rencana: RencanaKalender[];
    belum: BelumKalender[];
    jadwalkan: (k: Kelompok) => void;
    buka: (r: RencanaKalender) => void;
    tutup: () => void;
    sibuk: boolean;
}) {
    const [pilih, setPilih] = useState(belum[0] ? kunci(belum[0]) : "");
    const terpilih = belum.find((b) => kunci(b) === pilih);
    return (
        <>
            <DialogHeader>
                <DialogTitle>{tglPanjang(tanggal)}</DialogTitle>
                <DialogDescription>
                    {rencana.length ? `${rencana.length} kelompok pemeriksaan pada hari ini.` : "Belum ada pemeriksaan pada hari ini."}
                </DialogDescription>
            </DialogHeader>
            {rencana.length > 0 && (
                <ul className="flex flex-col gap-2">
                    {rencana.map((r) => {
                        const s = statusRencana(r, hariIni);
                        return (
                            <li key={kunci(r)} className="flex items-center gap-3 rounded-kontrol border p-2.5">
                                <IlustrasiModul modul={modulDari(r.tipeSlug)} ukuran={40} />
                                <span className="min-w-0 flex-1 leading-tight">
                                    <b className="block text-sm">
                                        {r.tipeNama} · {r.jumlah} unit
                                    </b>
                                    <span className="text-xs text-muted-foreground">{namaTempat(r.tempat)}</span>
                                </span>
                                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", s.kelas)}>{s.label}</span>
                                {r.selesai < r.jumlah && (
                                    <Button size="sm" variant="ghost" onClick={() => buka(r)} aria-label={`Ubah tanggal ${r.tipeNama} ${namaTempat(r.tempat)}`}>
                                        <MoveRight aria-hidden />
                                    </Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            <div className="rounded-kontrol bg-muted/60 p-3">
                <p className="mb-2 text-sm font-semibold">Jadwalkan di tanggal ini</p>
                {belum.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada kelompok belum terjadwal yang periodenya mencakup tanggal ini.</p>
                ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Pilihan
                            aria-label="Kelompok yang dijadwalkan"
                            value={pilih}
                            onValueChange={setPilih}
                            className="min-w-0 flex-1"
                            opsi={belum.map((b) => ({
                                value: kunci(b),
                                label: `${b.tipeNama} · ${namaTempat(b.tempat)} (${b.jumlah} unit)`,
                            }))}
                        />
                        <Button disabled={!terpilih || sibuk} onClick={() => terpilih && jadwalkan(terpilih)}>
                            <CalendarPlus aria-hidden /> Jadwalkan
                        </Button>
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={tutup}>
                    Tutup
                </Button>
            </DialogFooter>
        </>
    );
}

function IsiUbahTanggal({
    k,
    rencana,
    hariIni,
    tempo,
    simpan,
    lepas,
    tutup,
    sibuk,
}: {
    k: Kelompok;
    rencana: RencanaKalender | null;
    hariIni: string;
    tempo: string;
    simpan: (t: string) => void;
    lepas?: () => void;
    tutup: () => void;
    sibuk: boolean;
}) {
    const awal = rencana?.tanggal ?? (hariIni >= k.periode && hariIni <= tempo ? hariIni : k.periode);
    const [t, setT] = useState(awal);
    const sah = t >= k.periode && t <= tempo;
    return (
        <>
            <DialogHeader>
                <DialogTitle>{rencana ? "Ubah tanggal pemeriksaan" : "Jadwalkan pemeriksaan"}</DialogTitle>
                <DialogDescription>
                    {k.tipeNama} di {namaTempat(k.tempat)}, {k.jumlah} unit.
                </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 rounded-kontrol border p-3">
                <IlustrasiModul modul={modulDari(k.tipeSlug)} ukuran={56} />
                <p className="text-sm text-muted-foreground">
                    Periode {tglPendek(k.periode)} sampai {tglPendek(tempo)}.
                    {rencana && ` Sekarang dijadwalkan ${tglPanjang(rencana.tanggal)}.`}
                </p>
            </div>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
                Tanggal pemeriksaan
                <Input
                    type="date"
                    value={t}
                    min={k.periode}
                    max={tempo}
                    onChange={(e) => setT(e.target.value)}
                    aria-invalid={!sah}
                    aria-describedby="bantuan-tanggal"
                />
                <span id="bantuan-tanggal" className={cn("text-xs font-normal", sah ? "text-muted-foreground" : "text-danger")}>
                    {sah ? tglPanjang(t) : "Pilih tanggal di dalam periodenya."}
                </span>
            </label>
            <DialogFooter className="gap-2 sm:justify-between">
                {lepas ? (
                    <Button variant="ghost" className="text-danger" onClick={lepas} disabled={sibuk}>
                        Lepas dari jadwal
                    </Button>
                ) : (
                    <span />
                )}
                <div className="flex gap-2">
                    <Button variant="outline" onClick={tutup}>
                        Batal
                    </Button>
                    <Button onClick={() => simpan(t)} disabled={!sah || sibuk || t === rencana?.tanggal}>
                        Simpan tanggal
                    </Button>
                </div>
            </DialogFooter>
        </>
    );
}
