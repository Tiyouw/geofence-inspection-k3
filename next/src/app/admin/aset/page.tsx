import type { Metadata } from "next";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kosong, Lencana, Paginasi, Pilihan, Tabel, halamanDari, qs } from "@/features/admin/components/ui";
import { labelRadius } from "@/features/admin/lib/label";
import { PER_HALAMAN_ASET, daftarAset, parseFilterAset, pilihanAset } from "@/features/admin/server/aset";
import { requireRole } from "@/lib/auth/guards";
import { LABEL_LOKASI, LOKASI_TIPE } from "@/lib/domain/constants";
import { labelLantai } from "@/lib/domain/asset";
import { formatTanggal } from "@/lib/format";

export const metadata: Metadata = { title: "Aset & APAR" };

export default async function DaftarAset({ searchParams }: PageProps<"/admin/aset">) {
    await requireRole("admin");
    const sp = await searchParams;
    const f = parseFilterAset(sp);
    const halaman = halamanDari(sp.hal);
    const [{ rows, total }, pilihan] = await Promise.all([daftarAset(f, halaman), pilihanAset()]);
    const param = {
        q: f.q,
        tipe: f.tipe,
        gedung: f.gedung,
        lokasi: f.lokasiTipe,
        aktif: f.aktif,
        tanpa_koordinat: f.tanpaKoordinat,
        jatuh_tempo: f.jatuhTempo,
    };

    return (
        <>
            <PageHeader
                title="Aset & APAR"
                description="Data induk sarana K3: identitas, penempatan, titik koordinat, dan radius gerbang GPS."
                actions={
                    <Button asChild variant="brand">
                        <Link href="/admin/aset/baru">
                            <Plus aria-hidden /> Tambah aset
                        </Link>
                    </Button>
                }
            />

            <form
                method="get"
                className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6"
                role="search"
                aria-label="Saring aset"
            >
                <label className="flex flex-col gap-1 text-xs font-medium sm:col-span-3 lg:col-span-2">
                    Cari
                    <Input name="q" defaultValue={f.q} placeholder="Nomor, gedung, atau lokasi" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                    Tipe objek
                    <Pilihan name="tipe" defaultValue={f.tipe ?? ""}>
                        <option value="">Semua</option>
                        {pilihan.tipe.map((t) => (
                            <option key={t.id} value={t.slug}>
                                {t.nama}
                            </option>
                        ))}
                    </Pilihan>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                    Gedung
                    <Pilihan name="gedung" defaultValue={f.gedung ?? ""}>
                        <option value="">Semua</option>
                        {pilihan.gedung.map((g) => (
                            <option key={g}>{g}</option>
                        ))}
                    </Pilihan>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                    Jenis lokasi
                    <Pilihan name="lokasi" defaultValue={f.lokasiTipe ?? ""}>
                        <option value="">Semua</option>
                        {LOKASI_TIPE.map((l) => (
                            <option key={l} value={l}>
                                {LABEL_LOKASI[l]}
                            </option>
                        ))}
                    </Pilihan>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                    Aktif
                    <Pilihan name="aktif" defaultValue={f.aktif ?? ""}>
                        <option value="">Semua</option>
                        <option value="ya">Aktif</option>
                        <option value="tidak">Nonaktif</option>
                    </Pilihan>
                </label>
                <div className="flex flex-wrap items-center gap-4 text-sm sm:col-span-3 lg:col-span-4">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            name="tanpa_koordinat"
                            value="1"
                            defaultChecked={f.tanpaKoordinat}
                            className="size-4 accent-primary"
                        />
                        Belum punya koordinat
                    </label>
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            name="jatuh_tempo"
                            value="1"
                            defaultChecked={f.jatuhTempo}
                            className="size-4 accent-primary"
                        />
                        Jatuh tempo inspeksi
                    </label>
                </div>
                <div className="flex items-end justify-end gap-2 sm:col-span-3 lg:col-span-2">
                    <Button asChild variant="ghost">
                        <Link href="/admin/aset">Atur ulang</Link>
                    </Button>
                    <Button type="submit">Terapkan</Button>
                </div>
            </form>

            {rows.length === 0 ? (
                <Kosong>Tidak ada aset yang cocok dengan penyaring.</Kosong>
            ) : (
                <Tabel>
                    <thead>
                        <tr>
                            <th>Nomor</th>
                            <th>Tipe</th>
                            <th>Gedung</th>
                            <th>Lantai</th>
                            <th>Lokasi</th>
                            <th>Jenis</th>
                            <th>Radius efektif</th>
                            <th>Titik</th>
                            <th>Divisi</th>
                            <th>Terakhir dicek</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((a) => (
                            <tr key={a.id}>
                                <td className="font-medium">
                                    <Link href={`/admin/aset/${a.id}`} className="hover:underline">
                                        {a.kode}
                                    </Link>
                                </td>
                                <td>{a.tipe}</td>
                                <td>{a.gedung ?? "-"}</td>
                                <td>{labelLantai(a.lantai) ?? "-"}</td>
                                <td className="max-w-56 truncate" title={a.lokasiTeks}>
                                    {a.lokasiTeks.length > 40 ? a.lokasiTeks.slice(0, 40) + "…" : a.lokasiTeks}
                                </td>
                                <td className="whitespace-nowrap">{LABEL_LOKASI[a.lokasiTipe]}</td>
                                <td className="whitespace-nowrap">{labelRadius(a.radiusM, a.lokasiTipe)}</td>
                                <td>
                                    {a.lat != null && a.lng != null ? (
                                        <span title={`${a.lat}, ${a.lng}`} aria-label={`Koordinat ${a.lat}, ${a.lng}`}>
                                            <Check className="size-4 text-success" aria-hidden />
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </td>
                                <td>{a.divisi ?? "-"}</td>
                                <td className="whitespace-nowrap">
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
