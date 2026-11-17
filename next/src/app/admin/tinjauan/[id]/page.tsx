import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shell/app-shell";
import { simpanCatatanReview } from "@/features/admin/actions/inspeksi";
import { AksiTinjau } from "@/features/admin/components/aksi-antrean";
import { FormCatatanReview } from "@/features/admin/components/form-catatan-review";
import { GaleriFoto } from "@/features/admin/components/galeri-foto";
import { Peta, type TitikTampil } from "@/features/admin/components/peta";
import { Kartu, Lencana } from "@/features/admin/components/ui";
import { LABEL_GERBANG } from "@/features/admin/lib/label";
import { LABEL_SEVERITY, LABEL_STATUS_TEMUAN } from "@/features/admin/lib/temuan";
import { detailInspeksi } from "@/features/admin/server/inspeksi";
import { fotoPerButir } from "@/features/inspeksi/server/foto-butir";
import { FotoPerButir } from "@/features/inspeksi/ui/foto-per-butir";
import { requireRole } from "@/lib/auth/guards";
import { radiusEfektif } from "@/lib/domain/asset";
import { DURASI_WAJAR_DETIK, LABEL_KESIMPULAN } from "@/lib/domain/constants";
import { labelLokasi } from "@/lib/domain/label-aset";
import { formatAngka, formatWaktu } from "@/lib/format";

export const metadata: Metadata = { title: "Detail inspeksi" };

const NILAI_DUA: Record<string, Record<string, string>> = {
    fungsi: { ok: "Berfungsi", tidak: "Tidak berfungsi" },
    kondisi: { ok: "Baik", tidak: "Tidak baik" },
    boolean: { ok: "Ada", tidak: "Tidak ada" },
};

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[10rem_1fr] gap-3 py-1.5 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

/**
 * Detail inspeksi (H5, F5): bukti lapangan dan foto hanya dibaca; yang bisa diubah hanya catatan tinjauan.
 * Foto disajikan lewat /api/foto/{id} yang memeriksa sesi; URL blob tidak pernah dikirim.
 */
export default async function DetailInspeksi({ params }: PageProps<"/admin/tinjauan/[id]">) {
    await requireRole("admin");
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) notFound();
    const [i, perButir] = await Promise.all([detailInspeksi(id), fotoPerButir(id)]);
    if (!i) notFound();

    const g = LABEL_GERBANG[i.gateStatus];
    const radius = radiusEfektif({ radiusAset: i.asetRadius, lokasiTipe: i.asetLokasiTipe });
    const titik: TitikTampil[] = [];
    if (i.asetLat != null && i.asetLng != null)
        titik.push({ id: 1, lat: i.asetLat, lng: i.asetLng, judul: `Titik aset ${i.asetKode}`, warna: "primary" });
    if (i.gpsLat != null && i.gpsLng != null)
        titik.push({
            id: 2,
            lat: i.gpsLat,
            lng: i.gpsLng,
            judul: "Posisi inspektur",
            rincian: `akurasi ±${i.gpsAccuracy ?? "-"} m`,
            warna: "info",
            cincin: true,
        });

    return (
        <>
            <PageHeader
                title={`Inspeksi ${i.asetKode}`}
                description={`${i.tipe} · ${labelLokasi({ lokasiTeks: i.asetLokasi, gedung: i.asetGedung, lantai: i.asetLantai })}`}
                actions={i.perluTinjauan ? <AksiTinjau id={i.id} /> : undefined}
            />

            <div className="grid gap-4 xl:grid-cols-2">
                <Kartu judul="Bukti lapangan (tidak dapat diubah)">
                    <dl className="divide-y">
                        <Baris label="Status">{i.status === "final" ? "Final" : "Draf (belum dikirim)"}</Baris>
                        <Baris label="Inspektur">
                            {i.inspektur} <span className="text-muted-foreground">({i.inspekturNip})</span>
                        </Baris>
                        <Baris label="Waktu resmi">{formatWaktu(i.inspectedAt)}</Baris>
                        <Baris label="Mulai mengisi">{formatWaktu(i.mulaiPada)}</Baris>
                        <Baris label="Durasi">
                            <span
                                className={
                                    i.durasiDetik != null && i.durasiDetik < DURASI_WAJAR_DETIK
                                        ? "font-semibold text-danger"
                                        : undefined
                                }
                            >
                                {i.durasiDetik != null ? `${formatAngka(i.durasiDetik)} detik` : "-"}
                            </span>
                        </Baris>
                        <Baris label="Pengiriman">
                            {i.offline ? "Antrean luring" : "Daring"}
                            {i.receivedAt && ` · tiba ${formatWaktu(i.receivedAt)}`}
                            {i.clockSkewS != null && Math.abs(i.clockSkewS) > 120 && (
                                <Lencana nada="warning" className="ml-2">
                                    Selisih jam {formatAngka(i.clockSkewS)} dtk
                                </Lencana>
                            )}
                        </Baris>
                        <Baris label="Stiker QR">
                            {i.qrVerified
                                ? `Terverifikasi${i.qrVerification === "offline_cache" ? " (cache luring)" : ""}`
                                : "Tidak"}
                        </Baris>
                        <Baris label="Gerbang GPS">
                            <Lencana nada={g.nada}>{g.label}</Lencana>
                        </Baris>
                        <Baris label="Jarak">
                            {i.jarakM != null ? `${formatAngka(i.jarakM)} m` : "-"} · batas{" "}
                            {radius != null ? `${radius} m` : "tidak berlaku"} · akurasi{" "}
                            {i.gpsAccuracy != null ? `±${formatAngka(i.gpsAccuracy)} m` : "-"}
                        </Baris>
                        <Baris label="Koordinat">{i.gpsLat != null ? `${i.gpsLat}, ${i.gpsLng}` : "-"}</Baris>
                        <Baris label="Kesimpulan">{i.kesimpulan ? LABEL_KESIMPULAN[i.kesimpulan] : "-"}</Baris>
                        <Baris label="Catatan">{i.catatan || "-"}</Baris>
                        <Baris label="Rekomendasi">{i.rekomendasi || "-"}</Baris>
                    </dl>
                </Kartu>

                <div className="flex flex-col gap-4">
                    <Kartu judul={`Foto bukti (${i.foto.length})`}>
                        <GaleriFoto
                            foto={i.foto.map((f) => ({
                                id: f.id,
                                keterangan: formatWaktu(f.takenAtDevice ?? f.uploadedAt),
                            }))}
                        />
                    </Kartu>
                    {perButir && (
                        <Kartu judul="Foto per butir">
                            <FotoPerButir data={perButir} />
                        </Kartu>
                    )}
                    {titik.length > 0 && (
                        <Kartu judul="Titik aset dan posisi inspektur">
                            <Peta titik={titik} tinggi={260} label="Peta posisi inspeksi" />
                        </Kartu>
                    )}
                </div>

                <Kartu judul="Hasil tinjauan admin">
                    <dl className="mb-4 divide-y">
                        <Baris label="Ditinjau">
                            {i.ditinjauPada
                                ? `${formatWaktu(i.ditinjauPada)} oleh ${i.peninjau ?? "-"}`
                                : i.perluTinjauan
                                  ? "Menunggu tinjauan"
                                  : "-"}
                        </Baris>
                    </dl>
                    {i.status === "final" ? (
                        <FormCatatanReview aksi={simpanCatatanReview} id={i.id} nilai={i.catatanReview ?? ""} />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Catatan tinjauan dapat diisi setelah inspeksi dikirim.
                        </p>
                    )}
                </Kartu>

                <Kartu judul={`Temuan (${i.temuan.length})`}>
                    {i.temuan.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Tidak ada temuan.</p>
                    ) : (
                        <ul className="divide-y text-sm">
                            {i.temuan.map((t) => (
                                <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                                    <Link href={`/admin/temuan/${t.id}`} className="hover:underline">
                                        {t.item}
                                    </Link>
                                    <span className="flex gap-1">
                                        <Lencana
                                            nada={
                                                t.severity === "berat"
                                                    ? "danger"
                                                    : t.severity === "sedang"
                                                      ? "warning"
                                                      : "muted"
                                            }
                                        >
                                            {LABEL_SEVERITY[t.severity]}
                                        </Lencana>
                                        <Lencana>{LABEL_STATUS_TEMUAN[t.status]}</Lencana>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Kartu>
            </div>

            <Kartu judul="Jawaban checklist" className="mt-4">
                {i.jawaban.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada jawaban.</p>
                ) : (
                    <ol className="divide-y text-sm">
                        {i.jawaban.map((j) => (
                            <li key={j.id} className="grid gap-1 py-2 sm:grid-cols-[2rem_1fr_14rem]">
                                <span className="text-muted-foreground tabular-nums">{j.urut}.</span>
                                <span>
                                    {j.label}
                                    <span className="block text-xs text-muted-foreground">
                                        {j.grup}
                                        {j.dasarHukum && ` · ${j.dasarHukum}`}
                                    </span>
                                    {j.catatan && <span className="block text-xs">Catatan: {j.catatan}</span>}
                                </span>
                                <span className="font-medium">
                                    {j.answerType === "number"
                                        ? `${j.nilaiAngka ?? "-"} ${j.satuan ?? ""}`
                                        : (NILAI_DUA[j.answerType]?.[j.nilai ?? ""] ?? j.nilai ?? "-")}
                                </span>
                            </li>
                        ))}
                    </ol>
                )}
            </Kartu>
        </>
    );
}
