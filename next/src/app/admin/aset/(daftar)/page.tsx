import type { Metadata } from "next";
import Link from "next/link";
import { Check, Plus, QrCode, SlidersHorizontal } from "lucide-react";
import { IlustrasiModul, modulDari } from "@/components/ilustrasi/modul";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kosong, Lencana, Paginasi, Pilihan, Tabel, halamanDari, qs } from "@/features/admin/components/ui";
import { AREA_BELUM, PER_HALAMAN_ASET, daftarAset, hitungBelumLengkap, parseFilterAset, pilihanAset } from "@/features/admin/server/aset";
import { requireRole } from "@/lib/auth/guards";
import { labelLantai } from "@/lib/domain/asset";
import { formatTanggal } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Aset" };

export default async function DaftarAset({ searchParams }: PageProps<"/admin/aset">) {
    await requireRole("admin");
    const sp = await searchParams;
    const f = parseFilterAset(sp);
    const halaman = halamanDari(sp.hal);
    const [{ rows, total }, pilihan, belum] = await Promise.all([daftarAset(f, halaman), pilihanAset(), hitungBelumLengkap()]);
    const namaArea = f.area === AREA_BELUM ? "Belum berarea" : pilihan.area.find((a) => a.id === f.area)?.nama;
    const aktifFilter = [
        f.q && `Cari: ${f.q}`,
        f.tipe && `Tipe: ${pilihan.tipe.find((t) => t.slug === f.tipe)?.nama ?? f.tipe}`,
        namaArea && `Area: ${namaArea}`,
        f.gedung && `Gedung: ${f.gedung}`,
        f.tanpaKoordinat && "Belum ada koordinat",
        f.aktif && (f.aktif === "ya" ? "Aktif" : "Nonaktif"),
        f.jatuhTempo && "Jatuh tempo inspeksi",
    ].filter((x): x is string => !!x);
    const param = {
        q: f.q,
        tipe: f.tipe,
        gedung: f.gedung,
        aktif: f.aktif,
        area: f.area,
        tanpa_koordinat: f.tanpaKoordinat,
        jatuh_tempo: f.jatuhTempo,
    };

    return (
        <>
            <PageHeader
                title="Aset"
                description="Semua peralatan K3 yang diperiksa: di mana letaknya, kapan terakhir dicek. Klik nomor aset untuk rinciannya."
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline">
                            <Link href="/stiker">
                                <QrCode aria-hidden /> Cetak stiker
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href="/admin/aset/baru">
                                <Plus aria-hidden /> Tambah aset
                            </Link>
                        </Button>
                    </div>
                }
            />

            <nav aria-label="Jenis peralatan" className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {[{ slug: "", nama: "Semua" }, ...pilihan.tipe].map((t) => (
                    <Link
                        key={t.slug || "semua"}
                        href={`/admin/aset${qs({ ...param, tipe: t.slug || undefined })}`}
                        aria-current={(f.tipe ?? "") === t.slug ? "page" : undefined}
                        className={cn(
                            "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-card pr-4 text-sm font-semibold transition-colors hover:border-ring aria-[current=page]:border-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background",
                            t.slug ? "pl-1.5" : "pl-4",
                        )}
                    >
                        {t.slug && <IlustrasiModul modul={modulDari(t.slug)} ukuran={32} />}
                        {t.nama}
                    </Link>
                ))}
            </nav>

            <form method="get" className="mb-4 rounded-kartu border bg-card p-4" role="search" aria-labelledby="judul-filter-aset">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 id="judul-filter-aset" className="flex items-center gap-2 text-sm font-semibold">
                        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden /> Filter
                    </h2>
                    <p className="text-xs text-muted-foreground" aria-live="polite">
                        {total} aset{aktifFilter.length ? " cocok dengan filter" : ""}
                    </p>
                </div>
                {f.gedung && <input type="hidden" name="gedung" value={f.gedung} />}
                {f.tipe && <input type="hidden" name="tipe" value={f.tipe} />}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
                    <label className="col-span-2 flex flex-col gap-1 text-xs font-medium">
                        Cari
                        <Input name="q" defaultValue={f.q} placeholder="Nomor, gedung, atau lokasi" />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                        Area
                        <Pilihan name="area" defaultValue={f.area === undefined ? "" : String(f.area)} data-testid="filter-area">
                            <option value="">Semua area</option>
                            <option value={AREA_BELUM}>{`Belum berarea (${belum.belumArea})`}</option>
                            <optgroup label="Area">
                                {pilihan.area.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.nama}
                                    </option>
                                ))}
                            </optgroup>
                        </Pilihan>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                        Koordinat
                        <Pilihan name="tanpa_koordinat" defaultValue={f.tanpaKoordinat ? "1" : ""}>
                            <option value="">Semua</option>
                            <option value="1">{`Belum ada koordinat (${belum.belumKoordinat})`}</option>
                        </Pilihan>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                        Status
                        <Pilihan name="aktif" defaultValue={f.aktif ?? ""}>
                            <option value="">Aktif dan nonaktif</option>
                            <option value="ya">Aktif</option>
                            <option value="tidak">Nonaktif</option>
                        </Pilihan>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium">
                        Jadwal
                        <Pilihan name="jatuh_tempo" defaultValue={f.jatuhTempo ? "1" : ""}>
                            <option value="">Semua</option>
                            <option value="1">Jatuh tempo inspeksi</option>
                        </Pilihan>
                    </label>
                    <div className="col-span-2 flex items-end justify-end gap-2 lg:col-span-6">
                        <Button asChild variant="ghost">
                            <Link href="/admin/aset">Hapus filter</Link>
                        </Button>
                        <Button type="submit">Terapkan filter</Button>
                    </div>
                </div>
                {aktifFilter.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-2 border-t pt-3" aria-label="Filter aktif">
                        {aktifFilter.map((x) => (
                            <li key={x}>
                                <Lencana nada="info">{x}</Lencana>
                            </li>
                        ))}
                    </ul>
                )}
            </form>

            {rows.length === 0 ? (
                <Kosong ilustrasi={<IlustrasiModul modul={modulDari(f.tipe)} ukuran={96} />}>Tidak ada aset yang cocok dengan filter. Coba hapus salah satu filter.</Kosong>
            ) : (
                <Tabel>
                    <thead>
                        <tr>
                            <th>Nomor</th>
                            <th>Jenis</th>
                            <th>Area</th>
                            <th>Lantai</th>
                            <th>Lokasi</th>
                            <th>Titik</th>
                            <th>Unit kerja</th>
                            <th>Terakhir dicek</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((a) => (
                            <tr key={a.id}>
                                <td className="font-semibold">
                                    <Link href={`/admin/aset/${a.id}`} className="inline-flex items-center gap-2.5 hover:underline">
                                        <IlustrasiModul modul={modulDari(a.tipe)} ukuran={36} />
                                        {a.kode}
                                    </Link>
                                </td>
                                <td data-label="Jenis">{a.tipe}</td>
                                <td data-label="Area">
                                    {a.area ??
                                        (a.isMobile ? (
                                            "Bergerak"
                                        ) : (
                                            <Link href={`/admin/aset${qs({ area: AREA_BELUM })}`} className="text-warning hover:underline">
                                                Belum berarea
                                            </Link>
                                        ))}
                                </td>
                                <td data-label="Lantai">{labelLantai(a.lantai) ?? "-"}</td>
                                <td data-label="Lokasi" className="max-w-56 truncate" title={a.lokasiTeks}>
                                    {a.lokasiTeks.length > 40 ? a.lokasiTeks.slice(0, 40) + "…" : a.lokasiTeks}
                                </td>
                                <td data-label="Titik di peta">
                                    {a.lat != null && a.lng != null ? (
                                        <span title="Bertitik di peta" aria-label="Bertitik di peta">
                                            <Check className="size-4 text-success" aria-hidden />
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </td>
                                <td data-label="Unit kerja">{a.divisi ?? "-"}</td>
                                <td data-label="Terakhir dicek" className="whitespace-nowrap">
                                    {a.terakhirDicek
                                        ? formatTanggal(a.terakhirDicek + "T00:00:00+07:00", { dateStyle: "short" })
                                        : "belum pernah"}
                                </td>
                                <td>
                                    {a.aktif ? <Lencana nada="success">Aktif</Lencana> : <Lencana>Nonaktif</Lencana>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Tabel>
            )}
            <Paginasi
                halaman={halaman}
                total={total}
                per={PER_HALAMAN_ASET}
                hrefUntuk={(h) => `/admin/aset${qs({ ...param, hal: h > 1 ? h : undefined })}`}
            />
        </>
    );
}
