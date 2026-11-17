import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Kosong, Lencana, Paginasi, Pilihan, Tabel, halamanDari, qs } from "@/features/admin/components/ui";
import { LABEL_GERBANG } from "@/features/admin/lib/label";
import { jumlahAntreanTinjauan } from "@/features/admin/server/dasbor";
import {
    LABEL_TAB_INSPEKSI,
    PER_HALAMAN_INSPEKSI,
    TAB_INSPEKSI,
    daftarInspeksi,
    daftarInspektur,
    parseFilterInspeksi,
} from "@/features/admin/server/inspeksi";
import { AlasanTinjauan, HasilLencana } from "@/features/tinjauan/ui";
import { requireRole } from "@/lib/auth/guards";
import { DURASI_WAJAR_DETIK, GATE_STATUSES, KESIMPULAN, LABEL_KESIMPULAN } from "@/lib/domain/constants";
import { labelLokasi } from "@/lib/domain/label-aset";
import { formatAngka, formatTanggal } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Tinjauan inspeksi" };

function durasi(d: number | null): string {
    if (d == null) return "-";
    return d < 60 ? `${d} dtk` : `${Math.floor(d / 60)} mnt ${d % 60} dtk`;
}

/** Daftar inspeksi dan antrean tinjauan (SPEC §4.6, H7). Inspeksi tidak bisa dibuat dari panel (B8). */
export default async function DaftarTinjauan({ searchParams }: PageProps<"/admin/tinjauan">) {
    await requireRole("admin");
    const sp = await searchParams;
    const f = parseFilterInspeksi(sp, (await jumlahAntreanTinjauan()) > 0);
    const halaman = halamanDari(sp.hal);
    const [{ rows, total, lencana }, inspektur] = await Promise.all([daftarInspeksi(f, halaman), daftarInspektur()]);
    const param = {
        tab: f.tab,
        gate: f.gate,
        kesimpulan: f.kesimpulan,
        inspektur: f.inspektur,
        aset: f.aset,
        durasi: f.durasiTakWajar,
    };

    return (
        <>
            <PageHeader
                title="Tinjauan inspeksi"
                description="Bukti lapangan dari inspektur. Inspeksi perlu tinjauan (posisi di luar gedung, GPS lemah, area terbatas) diputuskan Diterima atau Ditolak oleh Admin K3 atau Pemantau."
            />

            <nav aria-label="Tab inspeksi" className="mb-4 flex flex-wrap gap-1 rounded-xl border bg-card p-1">
                {TAB_INSPEKSI.map((t) => (
                    <Link
                        key={t}
                        href={`/admin/tinjauan${qs({ ...param, tab: t, hal: undefined })}`}
                        aria-current={t === f.tab ? "page" : undefined}
                        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-muted aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                    >
                        {LABEL_TAB_INSPEKSI[t]}
                        {t === "antre" && lencana.antre > 0 && <Lencana nada="warning">{lencana.antre}</Lencana>}
                        {t === "tidak_layak" && lencana.tidak_layak > 0 && (
                            <Lencana nada="danger">{lencana.tidak_layak}</Lencana>
                        )}
                    </Link>
                ))}
            </nav>

            <form
                method="get"
                className="mb-4 grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
                aria-label="Saring inspeksi"
            >
                <input type="hidden" name="tab" value={f.tab} />
                {f.aset && <input type="hidden" name="aset" value={f.aset} />}
                <label className="flex flex-col gap-1 text-xs font-medium">
                    Status gerbang
                    <Pilihan name="gate" defaultValue={f.gate ?? ""}>
                        <option value="">Semua</option>
                        {GATE_STATUSES.map((g) => (
                            <option key={g} value={g}>
                                {LABEL_GERBANG[g].label}
                            </option>
                        ))}
                    </Pilihan>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                    Kesimpulan
                    <Pilihan name="kesimpulan" defaultValue={f.kesimpulan ?? ""}>
                        <option value="">Semua</option>
                        {KESIMPULAN.map((k) => (
                            <option key={k} value={k}>
                                {LABEL_KESIMPULAN[k]}
                            </option>
                        ))}
                    </Pilihan>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium">
                    Inspektur
                    <Pilihan name="inspektur" defaultValue={f.inspektur ?? ""}>
                        <option value="">Semua</option>
                        {inspektur.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.name}
                            </option>
                        ))}
                    </Pilihan>
                </label>
                <label className="flex items-center gap-2 self-end pb-1.5 text-sm">
                    <input
                        type="checkbox"
                        name="durasi"
                        value="1"
                        defaultChecked={f.durasiTakWajar}
                        className="size-4 accent-primary"
                    />
                    Durasi tak wajar (&lt; {DURASI_WAJAR_DETIK} dtk)
                </label>
                <div className="flex items-end justify-end gap-2">
                    <Button asChild variant="ghost">
                        <Link href={`/admin/tinjauan?tab=${f.tab}`}>Atur ulang</Link>
                    </Button>
                    <Button type="submit">Terapkan</Button>
                </div>
            </form>

            {rows.length === 0 ? (
                <Kosong>{f.tab === "antre" ? "Antrean tinjauan kosong." : "Tidak ada inspeksi yang cocok."}</Kosong>
            ) : (
                <Tabel>
                    <thead>
                        <tr>
                            <th>Waktu</th>
                            <th>Aset</th>
                            <th>Lokasi</th>
                            <th>Inspektur</th>
                            <th>QR</th>
                            <th>Gerbang</th>
                            <th>Jarak</th>
                            <th>Kesimpulan</th>
                            <th>Durasi</th>
                            <th>Status</th>
                            <th>Ditinjau</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((i) => {
                            const g = LABEL_GERBANG[i.gateStatus];
                            const takWajar = i.durasiDetik != null && i.durasiDetik < DURASI_WAJAR_DETIK;
                            return (
                                <tr key={i.id}>
                                    <td className="whitespace-nowrap">
                                        <Link href={`/admin/tinjauan/${i.id}`} className="font-medium hover:underline">
                                            {i.inspectedAt
                                                ? formatTanggal(i.inspectedAt, {
                                                      day: "2-digit",
                                                      month: "2-digit",
                                                      year: "numeric",
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                  })
                                                : "Draf"}
                                        </Link>
                                    </td>
                                    <td className="font-medium">{i.asetKode}</td>
                                    <td className="max-w-48 truncate">
                                        {labelLokasi({
                                            lokasiTeks: i.asetLokasi,
                                            gedung: i.asetGedung,
                                            lantai: i.asetLantai,
                                        })}
                                    </td>
                                    <td>{i.inspektur}</td>
                                    <td>
                                        {i.qrVerified ? (
                                            <Check className="size-4 text-success" aria-label="QR terverifikasi" />
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                    <td>
                                        {i.restrictedArea || i.gateAlasan ? (
                                            <AlasanTinjauan
                                                gateStatus={i.gateStatus}
                                                gateAlasan={i.gateAlasan}
                                                restrictedArea={i.restrictedArea}
                                            />
                                        ) : (
                                            <Lencana nada={g.nada}>{g.label}</Lencana>
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap tabular-nums">
                                        {i.jarakM != null ? `${formatAngka(i.jarakM)} m` : "-"}
                                        {i.gpsAccuracy != null && (
                                            <span className="text-muted-foreground">
                                                {" "}
                                                ±{formatAngka(i.gpsAccuracy)}
                                            </span>
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap">
                                        {i.kesimpulan ? LABEL_KESIMPULAN[i.kesimpulan] : "-"}
                                    </td>
                                    <td
                                        className={cn(
                                            "whitespace-nowrap tabular-nums",
                                            takWajar && "font-semibold text-danger",
                                        )}
                                    >
                                        {durasi(i.durasiDetik)}
                                    </td>
                                    <td>
                                        {i.status === "final" ? (
                                            <Lencana nada="info">Final</Lencana>
                                        ) : (
                                            <Lencana>Draf</Lencana>
                                        )}
                                        {i.offline && <Lencana className="ml-1">Luring</Lencana>}
                                    </td>
                                    <td className="whitespace-nowrap">
                                        {i.ditinjauPada ? (
                                            <span title={i.catatanReview ?? undefined}>
                                                <HasilLencana hasil={i.hasilTinjauan} />{" "}
                                                {formatTanggal(i.ditinjauPada, { dateStyle: "short" })} ·{" "}
                                                {i.peninjau ?? "-"}
                                            </span>
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </Tabel>
            )}
            <Paginasi
                halaman={halaman}
                total={total}
                per={PER_HALAMAN_INSPEKSI}
                hrefUntuk={(h) => `/admin/tinjauan${qs({ ...param, hal: h > 1 ? h : undefined })}`}
            />
        </>
    );
}
