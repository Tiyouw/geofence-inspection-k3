import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { Textarea } from "@/components/ui/textarea";
import { tetapkanPic, ubahStatusTemuan } from "@/features/admin/actions/temuan";
import { AksiTenggat } from "@/features/admin/components/aksi-antrean";
import { DialogAksi } from "@/features/admin/components/dialog-aksi";
import { Kartu, Lencana, Pilihan } from "@/features/admin/components/ui";
import {
    LABEL_SEVERITY,
    LABEL_STATUS_TEMUAN,
    TINDAKAN_BAKU,
    butuhUraian,
    lewatTenggat,
    transisiBerikut,
} from "@/features/admin/lib/temuan";
import { detailTemuan, pilihanTemuan } from "@/features/admin/server/temuan";
import { requireRole } from "@/lib/auth/guards";
import type { IssueStatus } from "@/lib/domain/constants";
import { labelLokasi } from "@/lib/domain/label-aset";
import { formatTanggal, formatWaktu, hariIniJakarta } from "@/lib/format";

export const metadata: Metadata = { title: "Detail temuan" };

const LABEL_TOMBOL: Record<string, string> = {
    "terbuka>proses": "Mulai proses",
    "terbuka>selesai": "Tandai selesai",
    "proses>selesai": "Tandai selesai",
    "proses>terbuka": "Kembalikan ke terbuka",
    "selesai>terbuka": "Buka kembali",
};

function uraianJejak(aksi: string, dari: unknown, ke: unknown): string {
    const k = (ke ?? {}) as Record<string, unknown>;
    switch (aksi) {
        case "buat":
            return "Temuan dicatat";
        case "status":
            return `Status ${LABEL_STATUS_TEMUAN[dari as IssueStatus] ?? dari} → ${LABEL_STATUS_TEMUAN[k.status as IssueStatus] ?? k.status}${k.uraian ? `: ${k.uraian}` : ""}`;
        case "tenggat":
            return `Tenggat ${dari ? formatTanggal(`${dari}T00:00:00+07:00`, { dateStyle: "medium" }) : "kosong"} → ${formatTanggal(`${ke}T00:00:00+07:00`, { dateStyle: "medium" })}`;
        case "pic":
            return ke ? "Penanggung jawab ditetapkan" : "Penanggung jawab dikosongkan";
        default:
            return aksi;
    }
}

export default async function DetailTemuan({ params }: PageProps<"/admin/temuan/[id]">) {
    await requireRole("admin");
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) notFound();
    const [t, pilihan] = await Promise.all([detailTemuan(id), pilihanTemuan()]);
    if (!t) notFound();
    const lewat = lewatTenggat(t, hariIniJakarta());

    return (
        <>
            <PageHeader
                title={`${t.asetKode}: ${t.item}`}
                description={labelLokasi({ lokasiTeks: t.asetLokasi, gedung: t.asetGedung, lantai: t.asetLantai })}
                actions={
                    <div className="flex flex-wrap gap-2">
                        {transisiBerikut(t.status).map((ke) => (
                            <DialogAksi
                                key={ke}
                                judul={LABEL_TOMBOL[`${t.status}>${ke}`] ?? ke}
                                deskripsi={
                                    ke === "selesai"
                                        ? "Uraikan tindakan yang sudah dilakukan. Uraian disimpan sebagai tindak lanjut."
                                        : butuhUraian(ke, t.status)
                                          ? "Jelaskan alasan temuan dibuka kembali."
                                          : `Ubah status menjadi ${LABEL_STATUS_TEMUAN[ke]}.`
                                }
                                pemicu={LABEL_TOMBOL[`${t.status}>${ke}`] ?? ke}
                                varianPemicu={ke === "selesai" ? "brand" : "outline"}
                                ukuranPemicu="default"
                                aksi={ubahStatusTemuan}
                                tersembunyi={{ id: t.id, ke }}
                                labelKirim={LABEL_TOMBOL[`${t.status}>${ke}`] ?? "Simpan"}
                            >
                                <label className="flex flex-col gap-1.5 text-sm font-medium">
                                    {ke === "selesai" ? "Tindakan yang sudah dilakukan" : "Uraian"}
                                    {butuhUraian(ke, t.status) ? (
                                        <Textarea name="uraian" required minLength={10} maxLength={2000} rows={4} />
                                    ) : (
                                        <Textarea name="uraian" maxLength={2000} rows={3} placeholder="Opsional" />
                                    )}
                                </label>
                            </DialogAksi>
                        ))}
                    </div>
                }
            />

            <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
                <Kartu judul="Rincian">
                    <dl className="grid gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
                        <dt className="text-muted-foreground">Status</dt>
                        <dd>
                            <Lencana
                                nada={t.status === "selesai" ? "success" : t.status === "proses" ? "info" : "muted"}
                            >
                                {LABEL_STATUS_TEMUAN[t.status]}
                            </Lencana>
                            {t.selesaiPada && (
                                <span className="ml-2 text-muted-foreground">{formatWaktu(t.selesaiPada)}</span>
                            )}
                        </dd>
                        <dt className="text-muted-foreground">Tingkat</dt>
                        <dd>
                            <Lencana
                                nada={t.severity === "berat" ? "danger" : t.severity === "sedang" ? "warning" : "muted"}
                            >
                                {LABEL_SEVERITY[t.severity]}
                            </Lencana>
                        </dd>
                        <dt className="text-muted-foreground">Tenggat</dt>
                        <dd className="flex flex-wrap items-center gap-2">
                            {t.targetSelesai ? formatTanggal(`${t.targetSelesai}T00:00:00+07:00`) : "Belum ditetapkan"}
                            {lewat && <Lencana nada="danger">Lewat tenggat</Lencana>}
                            {t.status !== "selesai" && <AksiTenggat id={t.id} targetSelesai={t.targetSelesai} />}
                        </dd>
                        <dt className="text-muted-foreground">Tindakan yang diminta</dt>
                        <dd>
                            {t.tindakLanjut || (
                                <span className="text-muted-foreground">{TINDAKAN_BAKU[t.severity]} (baku)</span>
                            )}
                        </dd>
                        <dt className="text-muted-foreground">Penanggung jawab</dt>
                        <dd className="flex flex-wrap items-center gap-2">
                            {t.pic ?? "Belum ada"}
                            <DialogAksi
                                judul="Penanggung jawab temuan"
                                pemicu="Atur"
                                aksi={tetapkanPic}
                                tersembunyi={{ id: t.id }}
                            >
                                <label className="flex flex-col gap-1.5 text-sm font-medium">
                                    Penanggung jawab
                                    <Pilihan name="picUserId" defaultValue={t.picUserId ?? ""}>
                                        <option value="">Tanpa penanggung jawab</option>
                                        {pilihan.pic.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.nip})
                                            </option>
                                        ))}
                                    </Pilihan>
                                </label>
                            </DialogAksi>
                        </dd>
                        <dt className="text-muted-foreground">Dicatat</dt>
                        <dd>{formatWaktu(t.createdAt)}</dd>
                        <dt className="text-muted-foreground">Sumber</dt>
                        <dd>
                            {t.inspectionId ? (
                                <Link href={`/admin/tinjauan/${t.inspectionId}`} className="underline">
                                    Inspeksi asal
                                </Link>
                            ) : (
                                "Dicatat manual"
                            )}
                        </dd>
                    </dl>
                </Kartu>

                <Kartu judul="Jejak tindak lanjut">
                    {t.jejak.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada perubahan.</p>
                    ) : (
                        <ol className="space-y-3 text-sm">
                            {t.jejak.map((j) => (
                                <li key={j.id} className="border-l-2 border-border pl-3">
                                    <p>{uraianJejak(j.aksi, j.dari, j.ke)}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {formatWaktu(j.createdAt)} · {j.oleh ?? "Sistem"}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    )}
                </Kartu>
            </div>
        </>
    );
}
