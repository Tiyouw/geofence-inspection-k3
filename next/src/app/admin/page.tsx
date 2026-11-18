import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarClock, CalendarDays, FileDown, ScanSearch, ShieldAlert } from "lucide-react";
import { IlustrasiModul, modulDari, warnaModul } from "@/components/ilustrasi/modul";
import { KerangkaHalaman } from "@/components/shell/kerangka-muat";
import { Button } from "@/components/ui/button";
import { Peta, type TitikTampil } from "@/features/admin/components/peta";
import { Kartu, Kosong, Lencana, qs } from "@/features/admin/components/ui";
import { LABEL_TAB, TAB_ANTREAN, parseTab, type StatusTitik, type TabAntrean } from "@/features/admin/lib/dasbor";
import { antreanDasbor, ringkasanDasbor, type BarisAntrean } from "@/features/admin/server/dasbor";
import { requireRole } from "@/lib/auth/guards";
import { AlasanTinjauan } from "@/features/tinjauan/ui";
import { KESIMPULAN, LABEL_KESIMPULAN } from "@/lib/domain/constants";
import { formatAngka, formatTanggal, formatWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ringkasan" };

const WARNA_STATUS: Record<StatusTitik, string> = {
    layak: "success",
    layak_catatan: "warning",
    tidak_layak: "danger",
    tanpa_kesimpulan: "info",
    belum: "muted-foreground",
};
const LABEL_STATUS_TITIK: Record<StatusTitik, string> = {
    ...LABEL_KESIMPULAN,
    belum: "Belum diperiksa",
    tanpa_kesimpulan: "Tanpa kesimpulan",
};

/**
 * Dasbor admin (PRD F14): progres pemeriksaan empat modul pada periodenya (bulan; minggu untuk mobil
 * pemadam), antrean keputusan, kondisi, tren, progres per gedung, dan peta aset bertitik.
 */
export default async function AdminDasbor({ searchParams }: PageProps<"/admin">) {
    const user = await requireRole("admin");
    const sp = await searchParams;
    const tab = parseTab(sp.tab);
    if (!tab) notFound();
    // Parameter sudah sah (status 404 tetap terkirim untuk tab asing); isi dasbor menyusul
    // di balik kerangka muat supaya halaman langsung tampil.
    return (
        <Suspense fallback={<KerangkaHalaman label="Memuat ringkasan…" />}>
            <IsiDasbor nama={user.name} tab={tab} hal={sp.hal} />
        </Suspense>
    );
}

async function IsiDasbor({ nama, tab, hal }: { nama: string; tab: TabAntrean; hal: string | string[] | undefined }) {
    const sp = { hal: typeof hal === "string" ? hal : undefined };
    const now = new Date();
    const [r, antrean] = await Promise.all([ringkasanDasbor(now), antreanDasbor(tab, sp.hal ?? 1, now)]);
    // Halaman yang kosong setelah entri terakhirnya diproses dikoreksi (I4).
    if (sp.hal !== undefined && String(antrean.halaman) !== sp.hal) {
        redirect(
            `/admin${qs({ tab: tab === "berat" ? undefined : tab, hal: antrean.halaman > 1 ? antrean.halaman : undefined })}`,
        );
    }
    const bulan = formatTanggal(r.periode.awal, { month: "long", year: "numeric" });
    const maksTren = Math.max(1, ...r.tren.map((t) => t.jumlah));

    const titik: TitikTampil[] = r.peta.titik.map((t) => ({
        id: t.id,
        lat: t.lat,
        lng: t.lng,
        judul: t.kode,
        rincian: `${t.lokasi} · ${LABEL_STATUS_TITIK[t.status]}${t.tinjau ? " · perlu tinjauan" : ""}`,
        warna: WARNA_STATUS[t.status],
        cincin: t.tinjau,
        href: `/admin/aset/${t.id}`,
    }));

    const IKON_TAB: Record<TabAntrean, { ikon: typeof ShieldAlert; nada: string }> = {
        berat: { ikon: ShieldAlert, nada: "bg-danger-soft text-danger" },
        tinjauan: { ikon: ScanSearch, nada: "bg-warning-soft text-warning" },
        belum: { ikon: CalendarClock, nada: "bg-info-soft text-info" },
    };

    return (
        <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-[26px]">Ringkasan {bulan}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {r.diperiksa} dari {r.total} unit sudah diperiksa pada periodenya. Selamat bekerja, {nama}.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline">
                        <Link href="/laporan">
                            <FileDown aria-hidden /> Laporan
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href="/admin/jadwal">
                            <CalendarDays aria-hidden /> Buka jadwal
                        </Link>
                    </Button>
                </div>
            </div>

            <section aria-labelledby="judul-modul">
                <h2 id="judul-modul" className="sr-only">
                    Progres per modul
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" data-testid="progres-modul">
                    {r.modul.map((m) => {
                        const jenis = modulDari(m.slug);
                        const warna = warnaModul(jenis);
                        return (
                            <li key={m.slug}>
                                <Link
                                    href={`/admin/aset?tipe=${encodeURIComponent(m.slug)}`}
                                    className="flex h-full flex-col gap-3 rounded-kartu border bg-card p-4 transition-shadow hover:shadow-md"
                                >
                                    <span className="flex items-center gap-3">
                                        <IlustrasiModul modul={jenis} ukuran={56} />
                                        <span className="min-w-0">
                                            <span className="block font-bold">{m.nama}</span>
                                            <span className="block text-xs text-muted-foreground">
                                                {m.mingguan
                                                    ? `Minggu ini s.d. ${formatTanggal(`${m.jatuhTempo}T12:00:00+07:00`, { day: "numeric", month: "short" })}`
                                                    : "Bulan ini"}
                                            </span>
                                        </span>
                                    </span>
                                    <span className="text-2xl font-extrabold tabular-nums">
                                        {m.sudah}
                                        <span className="text-sm font-semibold text-muted-foreground"> / {m.total} diperiksa</span>
                                    </span>
                                    <span className="block h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                                        <span
                                            className="block h-full rounded-full transition-[width] duration-500 ease-out"
                                            style={{ width: `${Math.min(100, m.persen)}%`, background: warna.utama }}
                                        />
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatAngka(m.persen, 1)}% · {Math.max(0, m.total - m.sudah)} belum
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </section>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
                <section className="rounded-kartu border bg-card p-5" aria-labelledby="judul-kepatuhan">
                    <h2 id="judul-kepatuhan" className="text-sm font-bold text-muted-foreground">
                        Ringkasan kepatuhan {bulan}
                    </h2>
                    <p className="mt-2 text-4xl font-extrabold tabular-nums text-peran-utama">{formatAngka(r.persen, 1)}%</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {r.diperiksa} dari {r.total} unit diperiksa pada periodenya, semua modul
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-peran-utama" style={{ width: `${Math.min(100, r.persen)}%` }} />
                    </div>
                </section>

                <nav aria-label="Antrean keputusan" className="grid gap-3 sm:grid-cols-3">
                    {TAB_ANTREAN.map((t) => {
                        const { ikon: Ikon, nada } = IKON_TAB[t];
                        return (
                            <Link
                                key={t}
                                href={`/admin${qs({ tab: t === "berat" ? undefined : t })}`}
                                aria-current={t === tab ? "page" : undefined}
                                className="flex items-center gap-3 rounded-kartu border bg-card p-4 transition-colors hover:border-ring aria-[current=page]:border-primary aria-[current=page]:ring-2 aria-[current=page]:ring-primary/20 sm:flex-col sm:items-start"
                            >
                                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", nada)}>
                                    <Ikon className="size-5" aria-hidden />
                                </span>
                                <span className="flex-1 text-sm font-semibold">{LABEL_TAB[t]}</span>
                                <span
                                    className={cn(
                                        "text-3xl font-extrabold tabular-nums",
                                        r.jumlah[t] > 0 &&
                                            (t === "tinjauan" ? "text-warning" : t === "berat" && "text-danger"),
                                    )}
                                >
                                    {formatAngka(r.jumlah[t])}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <Kartu judul={`Perlu keputusan Anda · ${LABEL_TAB[tab]}`} className="mt-4">
                {antrean.baris.length === 0 ? (
                    <Kosong ilustrasi={<IlustrasiModul modul={tab === "belum" ? "apar" : "p3k"} ukuran={96} />}>
                        Tidak ada entri. Antrean ini sudah bersih.
                    </Kosong>
                ) : (
                    <ul className="divide-y">
                        {antrean.baris.map((b) => (
                            <BarisAntreanItem key={`${b.jenis}-${b.id}`} b={b} tab={tab} />
                        ))}
                    </ul>
                )}
                {antrean.terakhir > 1 && (
                    <nav aria-label="Halaman antrean" className="mt-4 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                            Halaman {antrean.halaman} dari {antrean.terakhir}
                        </span>
                        <div className="flex gap-2">
                            {antrean.halaman > 1 && (
                                <Button asChild variant="outline" size="sm">
                                    <Link
                                        href={`/admin${qs({ tab: tab === "berat" ? undefined : tab, hal: antrean.halaman - 1 })}`}
                                    >
                                        Sebelumnya
                                    </Link>
                                </Button>
                            )}
                            {antrean.halaman < antrean.terakhir && (
                                <Button asChild variant="outline" size="sm">
                                    <Link
                                        href={`/admin${qs({ tab: tab === "berat" ? undefined : tab, hal: antrean.halaman + 1 })}`}
                                    >
                                        Berikutnya
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </nav>
                )}
            </Kartu>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <Kartu judul="Kondisi unit bulan ini">
                    <ul className="space-y-2 text-sm">
                        {KESIMPULAN.map((k) => (
                            <li key={k} className="flex items-center justify-between">
                                <span>{LABEL_KESIMPULAN[k]}</span>
                                <span className="font-semibold tabular-nums">{r.kondisi[k]}</span>
                            </li>
                        ))}
                        <li className="flex items-center justify-between text-muted-foreground">
                            <span>Belum diperiksa</span>
                            <span className="font-semibold tabular-nums">{r.jumlah.belum}</span>
                        </li>
                    </ul>
                </Kartu>

                <Kartu judul="Tren 6 bulan">
                    <ol className="flex h-36 items-end gap-2" aria-label="Jumlah unit diperiksa per bulan">
                        {r.tren.map((t) => (
                            <li key={t.kunci} className="flex flex-1 flex-col items-center gap-1">
                                <span className="text-xs font-semibold tabular-nums">{t.jumlah}</span>
                                <span
                                    className="w-full rounded-t-md bg-peran-utama"
                                    style={{ height: `${(t.jumlah / maksTren) * 96 + 2}px` }}
                                    aria-hidden
                                />
                                <span className="text-xs text-muted-foreground">
                                    {formatTanggal(t.periode.awal, { month: "short" })}
                                </span>
                            </li>
                        ))}
                    </ol>
                </Kartu>

                <Kartu judul="Progres per gedung">
                    {r.area.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada aset aktif.</p>
                    ) : (
                        <ul className="max-h-48 space-y-2 overflow-y-auto pr-1 text-sm">
                            {r.area.map((a) => (
                                <li key={a.nama}>
                                    <div className="flex justify-between gap-2">
                                        <span className="truncate">{a.nama}</span>
                                        <span className="tabular-nums text-muted-foreground">
                                            {a.sudah}/{a.total}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {a.modul.map((m) => `${m.nama} ${m.sudah}/${m.total}`).join(" · ")}
                                    </div>
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full rounded-full bg-peran-utama"
                                            style={{ width: `${(a.sudah / a.total) * 100}%` }}
                                        />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </Kartu>
            </div>

            <Kartu
                judul="Peta aset"
                className="mt-4"
                aksi={
                    r.peta.tanpaTitik > 0 ? (
                        <Link href="/admin/aset?tanpa_koordinat=1" className="text-xs text-muted-foreground underline">
                            {r.peta.tanpaTitik} aset tanpa koordinat
                        </Link>
                    ) : null
                }
            >
                <Peta titik={titik} label="Peta aset bertitik dan status pemeriksaan periode ini" />
                <ul
                    className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
                    aria-label="Keterangan warna"
                >
                    {(Object.keys(WARNA_STATUS) as StatusTitik[]).map((s) => (
                        <li key={s} className="flex items-center gap-1.5">
                            <span
                                className="size-2.5 rounded-full"
                                style={{ background: `var(--${WARNA_STATUS[s]})` }}
                                aria-hidden
                            />
                            {LABEL_STATUS_TITIK[s]}
                        </li>
                    ))}
                    <li className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full border-2 border-danger" aria-hidden />
                        Perlu tinjauan
                    </li>
                </ul>
            </Kartu>
        </>
    );
}

function BarisAntreanItem({ b, tab }: { b: BarisAntrean; tab: TabAntrean }) {
    if (b.jenis === "temuan") {
        return (
            <li className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                    <Link href={`/admin/temuan/${b.id}`} className="font-medium hover:underline">
                        {b.asetKode}: {b.item}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                        {b.modul} · {b.lokasi} · {formatTanggal(b.waktu, { dateStyle: "medium" })}
                    </p>
                </div>
                <Lencana nada="danger">Berat</Lencana>
            </li>
        );
    }
    if (b.jenis === "tinjauan") {
        return (
            <li className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                    <p className="font-medium">
                        {b.asetKode} · {b.modul}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {b.lokasi} · {b.inspektur} · {formatWaktu(b.inspectedAt)} · akurasi{" "}
                        {b.gpsAccuracy != null ? `±${formatAngka(b.gpsAccuracy)} m` : "-"}
                    </p>
                    <div className="mt-1">
                        <AlasanTinjauan gateStatus={b.gateStatus} gateAlasan={b.gateAlasan} restrictedArea={b.restrictedArea} />
                    </div>
                </div>
                <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/tinjauan/${b.id}`}>Tinjau</Link>
                </Button>
            </li>
        );
    }
    return (
        <li className="flex flex-wrap items-center justify-between gap-3 py-3" data-tab={tab}>
            <div>
                <p className="font-medium">
                    {b.asetKode} <span className="font-normal text-muted-foreground">· {b.modul}</span>
                </p>
                <p className="text-xs text-muted-foreground">{b.lokasi}</p>
            </div>
            <Button asChild variant="ghost" size="sm">
                <Link href={`/laporan/kartu/${b.id}`}>Kartu pemeriksaan ↗</Link>
            </Button>
        </li>
    );
}
