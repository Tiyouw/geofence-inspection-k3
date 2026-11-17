import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileDown } from "lucide-react";
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

    return (
        <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Halo, {nama}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {formatTanggal(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} ·
                        Periode {bulan}
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/laporan">
                        <FileDown aria-hidden /> Laporan bulanan
                    </Link>
                </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
                <section
                    className="rounded-xl border bg-primary p-5 text-primary-foreground"
                    aria-labelledby="judul-kepatuhan"
                >
                    <h2
                        id="judul-kepatuhan"
                        className="text-[11px] font-semibold tracking-[0.12em] uppercase opacity-80"
                    >
                        Ringkasan kepatuhan {bulan}
                    </h2>
                    <p className="mt-2 text-5xl font-semibold tabular-nums">{formatAngka(r.persen, 1)}%</p>
                    <p className="mt-1 text-sm opacity-80">
                        {r.diperiksa} dari {r.total} unit diperiksa pada periodenya · semua modul
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                        <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: `${Math.min(100, r.persen)}%` }}
                        />
                    </div>
                </section>

                <nav aria-label="Antrean keputusan" className="grid grid-cols-3 gap-3">
                    {TAB_ANTREAN.map((t) => (
                        <Link
                            key={t}
                            href={`/admin${qs({ tab: t === "berat" ? undefined : t })}`}
                            aria-current={t === tab ? "page" : undefined}
                            className={cn(
                                "flex flex-col justify-between rounded-xl border bg-card p-4 hover:border-ring aria-[current=page]:border-primary aria-[current=page]:ring-2 aria-[current=page]:ring-primary/25",
                            )}
                        >
                            <span className="text-xs font-medium text-muted-foreground">{LABEL_TAB[t]}</span>
                            <span
                                className={cn(
                                    "mt-2 text-3xl font-semibold tabular-nums",
                                    r.jumlah[t] > 0 &&
                                        (t === "tinjauan" ? "text-warning" : t === "berat" && "text-danger"),
                                )}
                            >
                                {formatAngka(r.jumlah[t])}
                            </span>
                        </Link>
                    ))}
                </nav>
            </div>

            <section aria-labelledby="judul-modul" className="mt-4">
                <h2 id="judul-modul" className="sr-only">
                    Progres per modul
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="progres-modul">
                    {r.modul.map((m) => (
                        <li key={m.slug} className="rounded-xl border bg-card p-4">
                            <div className="flex items-baseline justify-between gap-2">
                                <span className="text-sm font-medium">{m.nama}</span>
                                <span className="text-xs text-muted-foreground">
                                    {m.mingguan
                                        ? `Minggu ini s.d. ${formatTanggal(`${m.jatuhTempo}T12:00:00+07:00`, { day: "numeric", month: "short" })}`
                                        : "Bulan ini"}
                                </span>
                            </div>
                            <p className="mt-2 text-2xl font-semibold tabular-nums">{formatAngka(m.persen, 1)}%</p>
                            <p className="text-xs text-muted-foreground">
                                {m.sudah} dari {m.total} unit diperiksa
                            </p>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-success transition-[width] duration-500 ease-out"
                                    style={{ width: `${Math.min(100, m.persen)}%` }}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            <Kartu judul={`Perlu keputusan Anda · ${LABEL_TAB[tab]}`} className="mt-4">
                {antrean.baris.length === 0 ? (
                    <Kosong>Tidak ada entri. Antrean ini sudah bersih.</Kosong>
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
                                    className="w-full rounded-t bg-chart-3"
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
                                            className="h-full bg-success"
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
