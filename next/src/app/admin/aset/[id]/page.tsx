import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { ubahAset } from "@/features/admin/actions/aset";
import { FormAset } from "@/features/admin/components/form-aset";
import { GantiToken, LihatToken } from "@/features/admin/components/token-aset";
import { Kartu } from "@/features/admin/components/ui";
import { ambilAset, pilihanAset } from "@/features/admin/server/aset";
import { requireRole } from "@/lib/auth/guards";
import { bingkaiKawasan } from "@/lib/geo/data";
import { labelLokasi } from "@/lib/domain/label-aset";
import { formatTanggal, formatWaktu } from "@/lib/format";

export const metadata: Metadata = { title: "Ubah aset" };

export default async function UbahAset({ params }: PageProps<"/admin/aset/[id]">) {
    await requireRole("admin");
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();
    const [a, p, kawasan] = await Promise.all([ambilAset(id), pilihanAset(), bingkaiKawasan()]);
    if (!a) notFound();
    const attr = a.attributes ?? {};

    return (
        <>
            <PageHeader title={`Aset ${a.kode}`} description={labelLokasi(a)} />
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <FormAset
                    aksi={ubahAset.bind(null, a.id)}
                    nilai={{
                        ...a,
                        jenis:
                            typeof attr.jenis === "string"
                                ? attr.jenis
                                : typeof attr.tipe === "string"
                                  ? attr.tipe
                                  : "",
                        kapasitasKg: attr.kapasitas_kg != null ? Number(attr.kapasitas_kg) : null,
                    }}
                    tipe={p.tipe}
                    divisi={p.divisi}
                    area={p.area}
                    kawasan={kawasan}
                    labelKirim="Simpan perubahan"
                    terakhirDicekLabel={
                        a.terakhirDicek ? formatTanggal(a.terakhirDicek + "T00:00:00+07:00") : "Belum pernah"
                    }
                />
                <div className="flex flex-col gap-4">
                    <Kartu judul="Stiker QR">
                        <p className="mb-3 text-sm text-muted-foreground">
                            Token acak menjadi isi QR. Token tidak bisa diubah lewat formulir; ganti hanya bila stiker
                            rusak, hilang, atau disalahgunakan.
                        </p>
                        <p className="mb-3 text-xs text-muted-foreground">
                            {a.qrTokenRotatedAt
                                ? `Terakhir diganti ${formatWaktu(a.qrTokenRotatedAt)}`
                                : "Token belum pernah diganti."}
                        </p>
                        <div className="flex flex-col items-start gap-3">
                            <LihatToken id={a.id} />
                            <div className="flex flex-wrap gap-2">
                                <Button asChild variant="outline" size="sm">
                                    <Link href={`/stiker?kode=${encodeURIComponent(a.kode)}`}>
                                        <Printer aria-hidden /> Cetak stiker ini
                                    </Link>
                                </Button>
                                <GantiToken id={a.id} kode={a.kode} />
                            </div>
                        </div>
                    </Kartu>
                    <Kartu judul="Tautan">
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link className="underline" href={`/admin/tinjauan?tab=semua&aset=${a.id}`}>
                                    Riwayat inspeksi
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="underline"
                                    href={`/admin/temuan?status=semua&q=${encodeURIComponent(a.kode)}`}
                                >
                                    Temuan aset ini
                                </Link>
                            </li>
                            <li>
                                <Link className="underline" href={`/laporan/kartu/${a.id}`}>
                                    Kartu kontrol
                                </Link>
                            </li>
                        </ul>
                    </Kartu>
                </div>
            </div>
        </>
    );
}
