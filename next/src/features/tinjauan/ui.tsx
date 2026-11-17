/**
 * Antrean dan halaman tinjauan bersama Administrator K3 dan Pemantau (Server Components).
 * Peninjau melihat foto per butir, titik GPS di atas poligon gedung dan kawasan, akurasi, dan
 * alasan masuk antrean, lalu memutuskan Diterima atau Ditolak dengan catatan.
 */
import Link from "next/link";
import { GaleriFoto } from "@/features/admin/components/galeri-foto";
import { Peta, type LingkaranTampil, type PoligonTampil, type TitikTampil } from "@/features/admin/components/peta";
import { Kartu, Kosong, Lencana, Paginasi, Tabel, qs } from "@/features/admin/components/ui";
import { LABEL_GERBANG } from "@/features/admin/lib/label";
import { labelDuaNilai, isDuaNilai } from "@/lib/domain/inspeksi";
import {
    LABEL_GATE_ALASAN,
    LABEL_HASIL_TINJAUAN,
    LABEL_KESIMPULAN,
    type GateAlasan,
    type HasilTinjauan,
} from "@/lib/domain/constants";
import { formatAngka, formatWaktu } from "@/lib/format";
import { FormPutusan } from "./form-putusan";
import {
    LABEL_TAB_TINJAUAN,
    PER_HALAMAN_TINJAUAN,
    TAB_TINJAUAN,
    type DetailTinjauan,
    type TabTinjauan,
    type daftarTinjauan,
} from "./server";

const NADA_HASIL: Record<HasilTinjauan, "success" | "danger"> = { diterima: "success", ditolak: "danger" };

/** Alasan masuk antrean: area terbatas dan/atau alasan gerbang (status lama dipetakan seperlunya). */
export function AlasanTinjauan({
    gateStatus,
    gateAlasan,
    restrictedArea,
}: {
    gateStatus: keyof typeof LABEL_GERBANG;
    gateAlasan: GateAlasan | null;
    restrictedArea: boolean;
}) {
    const g = LABEL_GERBANG[gateStatus];
    return (
        <span className="flex flex-wrap gap-1">
            {restrictedArea && <Lencana nada="info">Area terbatas (tanpa foto)</Lencana>}
            {gateAlasan ? (
                <Lencana nada="warning">{LABEL_GATE_ALASAN[gateAlasan]}</Lencana>
            ) : (
                gateStatus !== "sesuai" && gateStatus !== "tidak_berlaku" && <Lencana nada={g.nada}>{g.label}</Lencana>
            )}
        </span>
    );
}

export function HasilLencana({ hasil }: { hasil: HasilTinjauan | null }) {
    if (!hasil) return <Lencana>Ditinjau</Lencana>;
    return <Lencana nada={NADA_HASIL[hasil]}>{LABEL_HASIL_TINJAUAN[hasil]}</Lencana>;
}

export function TabAntrean({ dasar, tab, menunggu }: { dasar: string; tab: TabTinjauan; menunggu: number }) {
    return (
        <nav aria-label="Tab tinjauan" className="mb-4 flex flex-wrap gap-1 rounded-xl border bg-card p-1">
            {TAB_TINJAUAN.map((t) => (
                <Link
                    key={t}
                    href={`${dasar}${qs({ tab: t === "menunggu" ? undefined : t })}`}
                    aria-current={t === tab ? "page" : undefined}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 hover:bg-muted aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                >
                    {LABEL_TAB_TINJAUAN[t]}
                    {t === "menunggu" && menunggu > 0 && <Lencana nada="warning">{menunggu}</Lencana>}
                </Link>
            ))}
        </nav>
    );
}

export function TabelAntrean({
    data,
    tab,
    halaman,
    dasar,
}: {
    data: Awaited<ReturnType<typeof daftarTinjauan>>;
    tab: TabTinjauan;
    halaman: number;
    dasar: string;
}) {
    if (data.rows.length === 0) {
        return (
            <Kosong>{tab === "menunggu" ? "Tidak ada inspeksi yang perlu ditinjau." : "Belum ada tinjauan."}</Kosong>
        );
    }
    return (
        <>
            <Tabel>
                <thead>
                    <tr>
                        <th>Waktu inspeksi</th>
                        <th>Aset</th>
                        <th>Inspektur</th>
                        <th>Alasan</th>
                        <th>Akurasi · jarak</th>
                        {tab === "ditinjau" && <th>Hasil</th>}
                    </tr>
                </thead>
                <tbody>
                    {data.rows.map((r) => {
                        const jarak = r.jarakKeAreaM ?? r.jarakM;
                        return (
                            <tr key={r.id}>
                                <td className="whitespace-nowrap">
                                    <Link href={`${dasar}/${r.id}`} className="font-medium hover:underline">
                                        {formatWaktu(r.inspectedAt)}
                                    </Link>
                                </td>
                                <td className="max-w-56">
                                    <span className="font-medium">{r.asetKode}</span>
                                    <span className="text-muted-foreground"> · {r.modul}</span>
                                    <span className="block text-xs text-muted-foreground">{r.lokasi}</span>
                                </td>
                                <td>{r.inspektur}</td>
                                <td>
                                    <AlasanTinjauan
                                        gateStatus={r.gateStatus}
                                        gateAlasan={r.gateAlasan}
                                        restrictedArea={r.restrictedArea}
                                    />
                                </td>
                                <td className="whitespace-nowrap tabular-nums">
                                    {r.gpsAccuracy != null ? `±${formatAngka(r.gpsAccuracy)} m` : "-"}
                                    {jarak != null && (
                                        <span className="text-muted-foreground"> · {formatAngka(jarak)} m</span>
                                    )}
                                </td>
                                {tab === "ditinjau" && (
                                    <td className="whitespace-nowrap">
                                        <HasilLencana hasil={r.hasilTinjauan} />
                                        <span className="block text-xs text-muted-foreground">
                                            {r.peninjau ?? "-"} · {formatWaktu(r.ditinjauPada)}
                                        </span>
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </Tabel>
            <Paginasi
                halaman={halaman}
                total={data.total}
                per={PER_HALAMAN_TINJAUAN}
                hrefUntuk={(h) =>
                    `${dasar}${qs({ tab: tab === "menunggu" ? undefined : tab, hal: h > 1 ? h : undefined })}`
                }
            />
        </>
    );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[10rem_1fr] gap-3 py-1.5 text-sm">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{children}</dd>
        </div>
    );
}

function nilaiJawaban(j: DetailTinjauan["butir"][number]): string {
    if (j.answerType === "number") return `${j.nilaiAngka ?? "-"}${j.satuan ? ` ${j.satuan}` : ""}`;
    if (isDuaNilai(j.answerType) && (j.nilai === "ok" || j.nilai === "tidak"))
        return labelDuaNilai(j.answerType)[j.nilai];
    return j.nilai ?? "-";
}

/** Halaman tinjauan satu inspeksi: bukti posisi, peta, foto per butir, dan keputusan. */
export function PanelTinjauan({ d, hrefTemuan }: { d: DetailTinjauan; hrefTemuan?: string }) {
    const jarak = d.jarakKeAreaM ?? d.jarakM;
    const titik: TitikTampil[] = [];
    if (d.asetLat != null && d.asetLng != null) {
        titik.push({ id: 1, lat: d.asetLat, lng: d.asetLng, judul: `Titik aset ${d.asetKode}`, warna: "primary" });
    }
    if (d.gpsLat != null && d.gpsLng != null) {
        titik.push({
            id: 2,
            lat: d.gpsLat,
            lng: d.gpsLng,
            judul: "Posisi inspektur",
            rincian: `akurasi ±${d.gpsAccuracy ?? "-"} m`,
            warna: "info",
            cincin: true,
        });
    }
    const poligon: PoligonTampil[] = [];
    if (d.kawasan?.polygon)
        poligon.push({ geojson: d.kawasan.polygon, judul: d.kawasan.nama, warna: "muted-foreground", putus: true });
    if (d.areaPoligon) poligon.push({ geojson: d.areaPoligon, judul: d.area ?? "Area aset", warna: "primary" });
    const lingkaran: LingkaranTampil[] =
        d.gpsLat != null && d.gpsLng != null && d.gpsAccuracy != null
            ? [
                  {
                      lat: d.gpsLat,
                      lng: d.gpsLng,
                      radius: d.gpsAccuracy,
                      warna: "info",
                      judul: `Akurasi ±${d.gpsAccuracy} m`,
                  },
              ]
            : [];
    const fotoId = new Map(d.foto.map((f) => [f.id, f]));
    const keterangan = (id: string) => {
        const f = fotoId.get(id);
        return [f?.langkah, formatWaktu(f?.takenAtDevice ?? f?.uploadedAt ?? null)].filter(Boolean).join(" · ");
    };

    return (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <div className="flex min-w-0 flex-col gap-4">
                <Kartu judul="Posisi inspektur terhadap area aset">
                    {d.bergerak ? (
                        <p className="text-sm text-muted-foreground">Objek bergerak: lokasi tidak diperiksa.</p>
                    ) : titik.length > 0 || poligon.length > 0 ? (
                        <Peta
                            titik={titik}
                            poligon={poligon}
                            lingkaran={lingkaran}
                            tinggi={340}
                            label="Peta posisi inspektur, poligon area aset, dan kawasan"
                        />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Tidak ada posisi atau poligon untuk ditampilkan.
                        </p>
                    )}
                    <dl className="mt-3 divide-y">
                        <Baris label="Alasan">
                            <AlasanTinjauan
                                gateStatus={d.gateStatus}
                                gateAlasan={d.gateAlasan}
                                restrictedArea={d.restrictedArea}
                            />
                        </Baris>
                        <Baris label="Akurasi GPS">
                            {d.gpsAccuracy != null ? `±${formatAngka(d.gpsAccuracy)} m` : "-"}
                            {d.gpsCapturedAt && (
                                <span className="text-muted-foreground"> · diambil {formatWaktu(d.gpsCapturedAt)}</span>
                            )}
                        </Baris>
                        <Baris label="Jarak ke area aset">{jarak != null ? `${formatAngka(jarak)} m` : "-"}</Baris>
                        <Baris label="Area aset">{d.area ?? "-"}</Baris>
                        <Baris label="Area terdeteksi">{d.areaTerdeteksi ?? "-"}</Baris>
                        <Baris label="Koordinat">{d.gpsLat != null ? `${d.gpsLat}, ${d.gpsLng}` : "-"}</Baris>
                    </dl>
                </Kartu>

                <Kartu judul="Jawaban dan foto per butir">
                    {d.restrictedArea && (
                        <p className="mb-3 rounded-lg bg-info-soft p-3 text-sm text-info">
                            Area terbatas: foto tidak diambil. Bukti cukup dari stiker QR dan GPS.
                        </p>
                    )}
                    {d.butir.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada jawaban.</p>
                    ) : (
                        <ol className="divide-y">
                            {d.butir.map((j) => (
                                <li key={j.checklistItemId} className="space-y-2 py-3">
                                    <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                                        <span>
                                            <span className="text-muted-foreground tabular-nums">{j.urut}. </span>
                                            {j.label}
                                            <span className="block text-xs text-muted-foreground">{j.grup}</span>
                                            {j.catatan && <span className="block text-xs">Catatan: {j.catatan}</span>}
                                        </span>
                                        <span className="font-medium">{nilaiJawaban(j)}</span>
                                    </div>
                                    {j.foto.length > 0 && (
                                        <GaleriFoto foto={j.foto.map((id) => ({ id, keterangan: keterangan(id) }))} />
                                    )}
                                </li>
                            ))}
                        </ol>
                    )}
                    {d.fotoLepas.length > 0 && (
                        <div className="mt-3 border-t pt-3">
                            <p className="mb-2 text-sm font-medium">Foto inspeksi ({d.fotoLepas.length})</p>
                            <GaleriFoto foto={d.fotoLepas.map((f) => ({ id: f.id, keterangan: keterangan(f.id) }))} />
                        </div>
                    )}
                </Kartu>
            </div>

            <div className="flex flex-col gap-4">
                <Kartu judul={d.menunggu ? "Keputusan tinjauan" : "Hasil tinjauan"}>
                    {d.menunggu ? (
                        <FormPutusan id={d.id} />
                    ) : d.ditinjauPada ? (
                        <dl className="divide-y">
                            <Baris label="Hasil">
                                <HasilLencana hasil={d.hasilTinjauan} />
                            </Baris>
                            <Baris label="Peninjau">{d.peninjau ?? "-"}</Baris>
                            <Baris label="Waktu">{formatWaktu(d.ditinjauPada)}</Baris>
                            <Baris label="Catatan">{d.catatanReview ?? "-"}</Baris>
                        </dl>
                    ) : (
                        <p className="text-sm text-muted-foreground">Inspeksi ini tidak memerlukan tinjauan.</p>
                    )}
                </Kartu>
                <Kartu judul="Inspeksi">
                    <dl className="divide-y">
                        <Baris label="Inspektur">
                            {d.inspektur} <span className="text-muted-foreground">({d.inspekturNip})</span>
                        </Baris>
                        <Baris label="Waktu resmi">{formatWaktu(d.inspectedAt)}</Baris>
                        <Baris label="Pengiriman">{d.offline ? "Antrean luring" : "Daring"}</Baris>
                        <Baris label="Stiker QR">{d.qrVerified ? "Terverifikasi" : "Tidak"}</Baris>
                        <Baris label="Kesimpulan">{d.kesimpulan ? LABEL_KESIMPULAN[d.kesimpulan] : "-"}</Baris>
                        <Baris label="Rekomendasi">{d.rekomendasi || "-"}</Baris>
                        {hrefTemuan && (
                            <Baris label="Temuan">
                                <Link href={hrefTemuan} className="hover:underline">
                                    Lihat temuan aset ini
                                </Link>
                            </Baris>
                        )}
                    </dl>
                </Kartu>
            </div>
        </div>
    );
}
