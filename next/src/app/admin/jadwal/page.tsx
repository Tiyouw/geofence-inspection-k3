import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ubahPeriodeTipe } from "@/features/admin/actions/jadwal";
import { DialogAksi } from "@/features/admin/components/dialog-aksi";
import { Kartu, Kosong, Lencana, Pilihan, Tabel } from "@/features/admin/components/ui";
import { labelJadwal } from "@/features/admin/lib/label";
import { mundurBulan, parsePeriode, periodeJakarta } from "@/features/admin/lib/periode";
import { KalenderJadwal } from "@/features/admin/components/kalender-jadwal";
import { belumDijadwalkan, daftarTipe, jadwalPeriode, rencanaKalender } from "@/features/admin/server/jadwal";
import { requireRole } from "@/lib/auth/guards";
import { PERIODE_MINGGUAN_HARI, awalMinggu } from "@/lib/domain/jadwal";
import { labelLokasi } from "@/lib/domain/label-aset";
import { formatTanggal, formatWaktu, hariIniJakarta } from "@/lib/format";

export const metadata: Metadata = { title: "Jadwal" };

const tgl = (d: string) => formatTanggal(`${d}T00:00:00+07:00`, { dateStyle: "medium" });

const tambahHari = (t: string, n: number) => {
    const d = new Date(`${t}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
};

/**
 * Jadwal (SPEC §3.9, G10; redesain A): kalender bulan/minggu untuk merencanakan pemeriksaan per
 * kelompok (jenis + gedung), dan daftar kewajiban per aset. Periode per jenis dapat diubah.
 */
export default async function Jadwal({ searchParams }: PageProps<"/admin/jadwal">) {
    await requireRole("admin");
    const sp = await searchParams;
    const tampil = sp.tampil === "daftar" ? "daftar" : "kalender";
    const tipe = await daftarTipe();

    return (
        <>
            <PageHeader
                title="Jadwal"
                description="Rencanakan kapan tiap gedung diperiksa. Klik tanggal untuk menjadwalkan, seret kartu untuk memindahkan."
            />
            <nav aria-label="Tampilan jadwal" className="mb-4 flex gap-1 border-b">
                {(
                    [
                        ["kalender", "Kalender", "/admin/jadwal"],
                        ["daftar", "Daftar per aset", "/admin/jadwal?tampil=daftar"],
                    ] as const
                ).map(([k, label, href]) => (
                    <Link
                        key={k}
                        href={href}
                        aria-current={tampil === k ? "page" : undefined}
                        className="-mb-px border-b-2 border-transparent px-3.5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:text-foreground"
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            {tampil === "kalender" ? <Kalender sp={sp} tipe={tipe} /> : <Daftar sp={sp} tipe={tipe} />}
            <PeriodeTipe tipe={tipe} />
        </>
    );
}

type Sp = Awaited<PageProps<"/admin/jadwal">["searchParams"]>;
type Tipe = Awaited<ReturnType<typeof daftarTipe>>;

async function Kalender({ sp, tipe }: { sp: Sp; tipe: Tipe }) {
    const hariIni = hariIniJakarta();
    const p = parsePeriode(typeof sp.bulan === "string" ? sp.bulan : undefined) ?? periodeJakarta();
    const lihat = sp.lihat === "minggu" ? "minggu" : "bulan";
    const tgl = typeof sp.tgl === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.tgl) ? sp.tgl : null;
    const jangkar = tgl ?? (hariIni.slice(0, 7) === p.tanggal.slice(0, 7) ? hariIni : p.tanggal);
    const awal = lihat === "minggu" ? awalMinggu(jangkar) : awalMinggu(p.tanggal);
    const akhir = tambahHari(awal, lihat === "minggu" ? 6 : 41);
    const [rencana, belum] = await Promise.all([rencanaKalender(awal, akhir), belumDijadwalkan(p, hariIni)]);
    return (
        <KalenderJadwal
            bulan={p.tanggal}
            hariIni={hariIni}
            lihat={lihat}
            jangkar={jangkar}
            rencana={rencana}
            belum={belum}
            tipe={tipe.filter((t) => t.aktif).map((t) => ({ slug: t.slug, nama: t.nama, periodeHari: t.periodeHari }))}
        />
    );
}

async function Daftar({ sp, tipe }: { sp: Sp; tipe: Tipe }) {
    const p = parsePeriode(typeof sp.periode === "string" ? sp.periode : undefined) ?? periodeJakarta();
    const tipeSlug = typeof sp.tipe === "string" && sp.tipe ? sp.tipe : "apar";
    const rows = await jadwalPeriode(p, tipeSlug);
    const hariIni = hariIniJakarta();
    const label = rows.map((r) => labelJadwal(r.status, r.jatuhTempo, hariIni));
    const hitung = label.reduce<Record<string, number>>((a, l) => ((a[l.label] = (a[l.label] ?? 0) + 1), a), {});
    const pilihanBulan = Array.from({ length: 13 }, (_, i) => mundurBulan(periodeJakarta(), i));

    return (
        <div>
                    <form
                        method="get"
                        className="mb-4 flex flex-wrap items-end gap-3 rounded-kartu border bg-card p-4"
                        aria-label="Pilih periode"
                    >
                        <input type="hidden" name="tampil" value="daftar" />
                        <label className="flex flex-col gap-1 text-xs font-medium">
                            Periode
                            <Pilihan name="periode" defaultValue={p.tanggal.slice(0, 7)}>
                                {pilihanBulan.map((b) => (
                                    <option key={b.tanggal} value={b.tanggal.slice(0, 7)}>
                                        {formatTanggal(b.awal, { month: "long", year: "numeric" })}
                                    </option>
                                ))}
                            </Pilihan>
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-medium">
                            Tipe objek
                            <Pilihan name="tipe" defaultValue={tipeSlug}>
                                {tipe.map((t) => (
                                    <option key={t.id} value={t.slug}>
                                        {t.nama}
                                    </option>
                                ))}
                            </Pilihan>
                        </label>
                        <Button type="submit">Tampilkan</Button>
                        <div className="ml-auto flex flex-wrap gap-2 text-xs">
                            {Object.entries(hitung).map(([k, n]) => (
                                <Lencana key={k}>
                                    {k}: {n}
                                </Lencana>
                            ))}
                        </div>
                    </form>
                    {rows.length === 0 ? (
                        <Kosong>Tidak ada aset aktif untuk tipe ini.</Kosong>
                    ) : (
                        <Tabel>
                            <thead>
                                <tr>
                                    <th>Aset</th>
                                    {rows[0]?.mingguan && <th>Minggu</th>}
                                    <th>Lokasi</th>
                                    <th>Jatuh tempo</th>
                                    <th>Status</th>
                                    <th>Diperiksa</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r, i) => (
                                    <tr key={`${r.asetId}:${r.periode}`}>
                                        <td className="font-medium">
                                            <Link href={`/admin/aset/${r.asetId}`} className="hover:underline">
                                                {r.kode}
                                            </Link>
                                        </td>
                                        {r.mingguan && (
                                            <td className="whitespace-nowrap">
                                                {tgl(r.periode)} s.d. {tgl(r.jatuhTempo)}
                                            </td>
                                        )}
                                        <td data-label="Lokasi">{labelLokasi(r)}</td>
                                        <td data-label="Jatuh tempo" className="whitespace-nowrap">
                                            {tgl(r.jatuhTempo)}
                                            {!r.adaBaris && (
                                                <span className="block text-xs text-muted-foreground">
                                                    turunan (belum ada baris jadwal)
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <Lencana nada={label[i]!.nada}>{label[i]!.label}</Lencana>
                                        </td>
                                        <td className="whitespace-nowrap">
                                            {r.inspectionId ? (
                                                <Link
                                                    href={`/admin/tinjauan/${r.inspectionId}`}
                                                    className="hover:underline"
                                                >
                                                    {formatWaktu(r.inspectedAt)} · {r.inspektur}
                                                </Link>
                                            ) : (
                                                "-"
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Tabel>
                    )}
        </div>
    );
}

function PeriodeTipe({ tipe }: { tipe: Tipe }) {
    return (
                <Kartu judul="Periode pemeriksaan per jenis" className="mt-6">
                    <ul className="divide-y text-sm">
                        {tipe.map((t) => (
                            <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                                <span>
                                    {t.nama}
                                    <span className="block text-xs text-muted-foreground">
                                        {t.periodeHari === PERIODE_MINGGUAN_HARI ? "mingguan (Senin s.d. Minggu)" : `tiap ${t.periodeHari} hari`} ·{" "}
                                        {t.jumlahAset} aset aktif
                                    </span>
                                </span>
                                <DialogAksi
                                    judul={`Periode inspeksi ${t.nama}`}
                                    deskripsi="Berlaku untuk jadwal yang dibuat sesudahnya. APAR mengikuti NFPA 10 (30 hari)."
                                    pemicu="Ubah"
                                    ukuranPemicu="xs"
                                    aksi={ubahPeriodeTipe}
                                    tersembunyi={{ id: t.id }}
                                >
                                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                                        Periode (hari)
                                        <Input
                                            name="periodeHari"
                                            type="number"
                                            min={1}
                                            max={366}
                                            defaultValue={t.periodeHari}
                                            required
                                        />
                                    </label>
                                </DialogAksi>
                            </li>
                        ))}
                    </ul>
                </Kartu>
    );
}
