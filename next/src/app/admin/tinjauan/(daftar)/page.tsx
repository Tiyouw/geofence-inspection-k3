import type { Metadata } from "next";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { Check } from "lucide-react";
import { IlustrasiModul, modulDari } from "@/components/ilustrasi/modul";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Kosong, Lencana, Paginasi, Pilihan, halamanDari, qs } from "@/features/admin/components/ui";
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
                description="Kiriman yang lokasinya di luar gedung, sinyal GPS-nya lemah, atau dari area terbatas masuk ke sini. Terima bila wajar; tolak bila perlu diperiksa ulang."
            />

            <nav aria-label="Tab inspeksi" className="mb-4 flex flex-wrap gap-1 rounded-kartu border bg-card p-1">
                {TAB_INSPEKSI.map((t) => (
                    <Link
                        key={t}
                        href={`/admin/tinjauan${qs({ ...param, tab: t, hal: undefined })}`}
                        aria-current={t === f.tab ? "page" : undefined}
                        className="flex min-h-10 items-center gap-2 rounded-kontrol px-3.5 text-sm font-semibold hover:bg-muted aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
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
                className="mb-4 grid grid-cols-2 gap-3 rounded-kartu border bg-card p-4 lg:grid-cols-5"
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
                    <Checkbox name="durasi" value="1" defaultChecked={f.durasiTakWajar} />
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
                <Kosong ilustrasi={<IlustrasiModul modul="p3k" ukuran={96} />}>
                    {f.tab === "antre" ? "Antrean tinjauan kosong. Kiriman baru akan muncul di sini." : "Tidak ada inspeksi yang cocok."}
                </Kosong>
            ) : (
                <ul className="flex flex-col gap-2" aria-label="Daftar inspeksi">
                    {rows.map((i) => {
                        const g = LABEL_GERBANG[i.gateStatus];
                        const takWajar = i.durasiDetik != null && i.durasiDetik < DURASI_WAJAR_DETIK;
                        const waktu = i.inspectedAt
                            ? formatTanggal(i.inspectedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                            : "Draf";
                        return (
                            <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-kartu border bg-card p-4">
                                <IlustrasiModul modul={modulDari(i.asetTipe ?? i.asetKode)} ukuran={48} />
                                <div className="min-w-48 flex-1">
                                    <Link href={`/admin/tinjauan/${i.id}`} className="font-bold hover:underline">
                                        {i.asetKode} ·{" "}
                                        {labelLokasi({ lokasiTeks: i.asetLokasi, gedung: i.asetGedung, lantai: i.asetLantai })}
                                    </Link>
                                    <p className="text-sm text-muted-foreground">
                                        {i.inspektur} · {waktu}
                                        {i.qrVerified && (
                                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-success">
                                                <Check className="size-3.5" aria-hidden /> QR cocok
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex min-w-48 flex-col items-start gap-1 sm:items-end">
                                    {i.restrictedArea || i.gateAlasan ? (
                                        <AlasanTinjauan gateStatus={i.gateStatus} gateAlasan={i.gateAlasan} restrictedArea={i.restrictedArea} />
                                    ) : (
                                        <Lencana nada={g.nada}>{g.label}</Lencana>
                                    )}
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {i.jarakM != null ? `${formatAngka(i.jarakM)} m dari area` : "Jarak tidak ada"}
                                        {i.gpsAccuracy != null && ` · GPS ±${formatAngka(i.gpsAccuracy)} m`}
                                        {" · "}
                                        <span className={cn(takWajar && "font-semibold text-danger")}>
                                            diisi {durasi(i.durasiDetik)}
                                            {takWajar && " (terlalu cepat)"}
                                        </span>
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {i.kesimpulan && <Lencana>{LABEL_KESIMPULAN[i.kesimpulan]}</Lencana>}
                                    {i.status === "final" ? <Lencana nada="info">Final</Lencana> : <Lencana>Draf</Lencana>}
                                    {i.offline && <Lencana>Luring</Lencana>}
                                    {i.ditinjauPada && (
                                        <span title={i.catatanReview ?? undefined} className="text-xs text-muted-foreground">
                                            <HasilLencana hasil={i.hasilTinjauan} /> {formatTanggal(i.ditinjauPada, { dateStyle: "short" })} ·{" "}
                                            {i.peninjau ?? "-"}
                                        </span>
                                    )}
                                </div>
                                <Button asChild size="sm" variant={i.ditinjauPada ? "outline" : "default"}>
                                    <Link href={`/admin/tinjauan/${i.id}`}>{i.ditinjauPada ? "Lihat" : "Tinjau"}</Link>
                                </Button>
                            </li>
                        );
                    })}
                </ul>
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
