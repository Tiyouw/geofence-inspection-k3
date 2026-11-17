/**
 * Tampilan temuan bersama Admin K3 dan Pemantau (Server Components). Temuan hanya dicatat:
 * tanpa status, tenggat, PIC, atau penutupan (ADR-4); laporan PDF adalah akhir alur.
 */
import Link from "next/link";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kartu, Kosong, Lencana, Paginasi, Pilihan, Tabel, qs } from "@/features/admin/components/ui";
import type { Nada } from "@/features/admin/lib/label";
import { GaleriFoto } from "@/features/admin/components/galeri-foto";
import { LABEL_KESIMPULAN, LABEL_TINDAKAN, SEVERITIES, type Severity } from "@/lib/domain/constants";
import { formatTanggal, formatWaktu } from "@/lib/format";
import { labelBerulang, paramFilterTemuan, type FilterTemuan } from "./filter";
import { PER_HALAMAN_TEMUAN, type BarisTemuan, type detailTemuan, type pilihanFilterTemuan } from "./server";

export const LABEL_TINGKAT: Record<Severity, string> = { berat: "Berat", sedang: "Sedang", ringan: "Ringan" };
export const NADA_TINGKAT: Record<Severity, Nada> = { berat: "danger", sedang: "warning", ringan: "muted" };

const tgl = (d: Date) => formatTanggal(d, { day: "2-digit", month: "short", year: "numeric" });

export function SaringTemuan({
    dasar,
    f,
    pilihan,
}: {
    dasar: string;
    f: FilterTemuan;
    pilihan: Awaited<ReturnType<typeof pilihanFilterTemuan>>;
}) {
    return (
        <form
            method="get"
            action={dasar}
            className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
            aria-label="Saring temuan"
        >
            <label className="flex flex-col gap-1 text-xs font-medium lg:col-span-2">
                Cari
                <Input name="q" defaultValue={f.q} placeholder="Uraian temuan atau kode aset" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
                Modul
                <Pilihan name="modul" defaultValue={f.modul ?? ""}>
                    <option value="">Semua modul</option>
                    {pilihan.modul.map((m) => (
                        <option key={m.slug} value={m.slug}>
                            {m.nama}
                        </option>
                    ))}
                </Pilihan>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
                Gedung atau area
                <Pilihan name="area" defaultValue={f.area ?? ""}>
                    <option value="">Semua</option>
                    {pilihan.area.map((a) => (
                        <option key={a.id} value={a.id}>
                            {a.nama}
                        </option>
                    ))}
                </Pilihan>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium">
                Tingkat
                <Pilihan name="tingkat" defaultValue={f.tingkat ?? ""}>
                    <option value="">Semua</option>
                    {SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                            {LABEL_TINGKAT[s]}
                        </option>
                    ))}
                </Pilihan>
            </label>
            <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium">
                    Dari
                    <Input type="date" name="dari" defaultValue={f.dari} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                    Sampai
                    <Input type="date" name="sampai" defaultValue={f.sampai} />
                </label>
            </div>
            <div className="flex flex-wrap items-end justify-end gap-2 sm:col-span-2 lg:col-span-6">
                <Button asChild variant="ghost">
                    <Link href={dasar}>Atur ulang</Link>
                </Button>
                <Button asChild variant="outline">
                    <a href={`/laporan/temuan${qs(paramFilterTemuan(f))}`} target="_blank" rel="noreferrer">
                        <FileDown aria-hidden /> Rekap PDF
                    </a>
                </Button>
                <Button type="submit">Terapkan</Button>
            </div>
        </form>
    );
}

export function TabelTemuan({
    rows,
    total,
    halaman,
    f,
    dasar,
}: {
    rows: BarisTemuan[];
    total: number;
    halaman: number;
    f: FilterTemuan;
    dasar: string;
}) {
    if (rows.length === 0) return <Kosong>Tidak ada temuan untuk saringan ini.</Kosong>;
    return (
        <>
            <Tabel label="Daftar temuan">
                <thead>
                    <tr>
                        <th>Tanggal</th>
                        <th>Lokasi</th>
                        <th>Temuan</th>
                        <th>Tingkat</th>
                        <th>Tindakan yang direkomendasikan</th>
                        <th>Inspektur</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((t) => {
                        const ulang = labelBerulang(t.berulang);
                        return (
                            <tr key={t.id}>
                                <td className="whitespace-nowrap">{tgl(t.waktu)}</td>
                                <td className="max-w-56">
                                    <span className="font-medium">{t.asetKode}</span>
                                    <span className="text-muted-foreground"> · {t.modul}</span>
                                    <span className="block text-xs text-muted-foreground">{t.lokasi}</span>
                                </td>
                                <td>
                                    <Link href={`${dasar}/${t.id}`} className="font-medium hover:underline">
                                        {t.item}
                                    </Link>
                                    {ulang && (
                                        <Lencana nada="info" className="ml-2">
                                            {ulang}
                                        </Lencana>
                                    )}
                                </td>
                                <td>
                                    <Lencana nada={NADA_TINGKAT[t.severity]}>{LABEL_TINGKAT[t.severity]}</Lencana>
                                </td>
                                <td>
                                    {LABEL_TINDAKAN[t.tindakan]}
                                    {t.uraianTindakan && (
                                        <span className="block text-xs text-muted-foreground">{t.uraianTindakan}</span>
                                    )}
                                </td>
                                <td className="whitespace-nowrap">{t.inspektur ?? "-"}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </Tabel>
            <Paginasi
                halaman={halaman}
                total={total}
                per={PER_HALAMAN_TEMUAN}
                hrefUntuk={(h) => `${dasar}${qs({ ...paramFilterTemuan(f), hal: h > 1 ? h : undefined })}`}
            />
        </>
    );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[11rem_1fr] gap-3 py-1.5 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

export function DetailTemuan({
    t,
    hrefInspeksi,
    hrefAset,
}: {
    t: NonNullable<Awaited<ReturnType<typeof detailTemuan>>>;
    hrefInspeksi: (id: string) => string;
    hrefAset?: (id: number) => string;
}) {
    const ulang = labelBerulang(t.berulang);
    return (
        <div className="grid gap-4 xl:grid-cols-2">
            <Kartu judul="Temuan">
                <dl className="divide-y">
                    <Baris label="Lokasi">{t.lokasi}</Baris>
                    <Baris label="Temuan">
                        {t.item}
                        {ulang && (
                            <Lencana nada="info" className="ml-2">
                                {ulang}
                            </Lencana>
                        )}
                    </Baris>
                    <Baris label="Tingkat">
                        <Lencana nada={NADA_TINGKAT[t.severity]}>{LABEL_TINGKAT[t.severity]}</Lencana>
                    </Baris>
                    <Baris label="Tindakan yang direkomendasikan">
                        {LABEL_TINDAKAN[t.tindakan]}
                        {t.uraianTindakan && <span className="block text-muted-foreground">{t.uraianTindakan}</span>}
                    </Baris>
                    {t.catatanButir && <Baris label="Catatan inspektur">{t.catatanButir}</Baris>}
                    <Baris label="Tanggal">{formatWaktu(t.waktu)}</Baris>
                </dl>
            </Kartu>
            <Kartu judul="Rujukan">
                <dl className="divide-y">
                    <Baris label="Aset">
                        {hrefAset ? (
                            <Link href={hrefAset(t.asetId)} className="font-medium hover:underline">
                                {t.asetKode}
                            </Link>
                        ) : (
                            <span className="font-medium">{t.asetKode}</span>
                        )}{" "}
                        · {t.modul}
                    </Baris>
                    <Baris label="Inspeksi">
                        {t.inspeksi ? (
                            <Link href={hrefInspeksi(t.inspeksi.id)} className="hover:underline">
                                {formatWaktu(t.inspeksi.inspectedAt)} oleh {t.inspektur ?? "-"}
                                {t.inspeksi.kesimpulan && ` · ${LABEL_KESIMPULAN[t.inspeksi.kesimpulan]}`}
                            </Link>
                        ) : (
                            "-"
                        )}
                    </Baris>
                    <Baris label="Dasar hukum butir">{t.dasarHukum ?? "-"}</Baris>
                </dl>
            </Kartu>
            <Kartu judul={`Foto butir (${t.foto.length})`} className="xl:col-span-2">
                {t.foto.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada foto untuk butir ini.</p>
                ) : (
                    <GaleriFoto
                        foto={t.foto.map((f) => ({
                            id: f.id,
                            keterangan: formatWaktu(f.takenAtDevice ?? f.uploadedAt),
                        }))}
                    />
                )}
            </Kartu>
        </div>
    );
}
