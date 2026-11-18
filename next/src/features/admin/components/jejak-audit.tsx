/**
 * Daftar jejak audit: dikelompokkan per hari, satu kalimat per kejadian (jam · ikon · kalimat).
 * Detail tersembunyi di balik "Lihat detail" (<details> asli: jalan tanpa JS, bisa dibuka
 * dengan papan ketik). Data mentah dan IP hanya di dalam "Data teknis". Tanpa gulir mendatar:
 * semua teks membungkus, tabel detail berubah jadi tumpukan di layar sempit.
 */
import {
    Bot,
    CalendarClock,
    ChevronRight,
    CircleCheck,
    CircleHelp,
    ClipboardCheck,
    Eye,
    FileUp,
    Hexagon,
    KeyRound,
    Link,
    LogIn,
    Map as IkonPeta,
    MapPinOff,
    Package,
    PenLine,
    Pencil,
    Printer,
    QrCode,
    Scale,
    ShieldX,
    Trash2,
    Undo2,
    Unlink,
    UserCheck,
    UserCog,
    UserPlus,
    UserX,
    type LucideIcon,
} from "lucide-react";
import {
    KATEGORI_AUDIT,
    jamMenit,
    judulHari,
    kalimatTeks,
    kelompokkanPerHari,
    kunciHari,
    uraikan,
    type BarisAudit,
    type KategoriAudit,
    type NamaIkon,
    type Rujukan,
    type Uraian,
} from "../lib/audit";
import { cn } from "@/lib/utils";

const IKON: Record<NamaIkon, LucideIcon> = {
    masuk: LogIn,
    "masuk-gagal": ShieldX,
    setujui: CircleCheck,
    impor: FileUp,
    ubah: Pencil,
    hapus: Trash2,
    pasang: Link,
    lepas: Unlink,
    kawasan: IkonPeta,
    draf: PenLine,
    buang: Undo2,
    "buat-area": Hexagon,
    inspeksi: ClipboardCheck,
    "tolak-lokasi": MapPinOff,
    tinjau: Scale,
    "tambah-pengguna": UserPlus,
    pengguna: UserCog,
    aktifkan: UserCheck,
    nonaktifkan: UserX,
    kunci: KeyRound,
    jadwal: CalendarClock,
    aset: Package,
    qr: QrCode,
    lihat: Eye,
    cetak: Printer,
    sistem: Bot,
    lain: CircleHelp,
};

/** Warna lingkaran ikon per kategori (token semantik). */
const NADA_KATEGORI: Record<KategoriAudit, string> = {
    area: "bg-info-soft text-info",
    aset: "bg-success-soft text-success",
    inspeksi: "bg-warning-soft text-warning",
    pengguna: "bg-muted text-foreground",
    masuk: "bg-muted text-muted-foreground",
    jadwal: "bg-info-soft text-info",
    lainnya: "bg-muted text-muted-foreground",
};

export function JejakAudit({ rows, rujukan, sekarang }: { rows: BarisAudit[]; rujukan: Rujukan; sekarang: Date }) {
    const hariIni = kunciHari(sekarang);
    return (
        <div className="flex flex-col gap-6" data-testid="jejak-audit">
            {kelompokkanPerHari(rows).map((g) => (
                <section key={g.hari} aria-labelledby={`hari-${g.hari}`}>
                    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
                        <h2 id={`hari-${g.hari}`} className="text-[13px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                            {judulHari(g.hari, hariIni)}
                        </h2>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{g.rows.length} kegiatan</span>
                    </div>
                    <ol className="rounded-kartu border bg-card py-1">
                        {g.rows.map((b) => (
                            <Kejadian key={b.id} b={b} rujukan={rujukan} />
                        ))}
                    </ol>
                </section>
            ))}
        </div>
    );
}

function Kejadian({ b, rujukan }: { b: BarisAudit; rujukan: Rujukan }) {
    const u = uraikan(b, rujukan);
    const Ikon = IKON[u.ikon];
    const adaPerubahan = u.detail.some((d) => d.dari !== undefined);
    return (
        <li
            className="group/kejadian relative flex min-w-0 gap-3 px-3 py-3 sm:gap-4 sm:px-5"
            data-aksi={b.aksi}
            data-testid="kejadian"
        >
            {/* Garis lini masa yang menyambung ikon antar-kejadian dalam satu hari. */}
            <span
                aria-hidden
                className="absolute top-0 bottom-0 left-[1.75rem] w-px bg-border group-first/kejadian:top-6 group-last/kejadian:bottom-auto group-last/kejadian:h-6 sm:left-[6.25rem]"
            />
            <time
                dateTime={b.createdAt.toISOString()}
                className="hidden w-14 shrink-0 pt-2 text-right text-sm font-semibold tabular-nums text-muted-foreground sm:block"
            >
                {jamMenit(b.createdAt)}
            </time>
            <span
                className={cn(
                    "relative z-[1] mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-card",
                    NADA_KATEGORI[u.kategori],
                )}
                title={u.label}
            >
                <Ikon className="size-4" aria-hidden />
                <span className="sr-only">{u.label}</span>
            </span>
            <div className="min-w-0 flex-1 pt-1">
                <p className="text-[15px] leading-relaxed break-words">
                    <time
                        dateTime={b.createdAt.toISOString()}
                        className="mr-2 inline-block text-xs font-semibold tabular-nums text-muted-foreground sm:hidden"
                    >
                        {jamMenit(b.createdAt)}
                    </time>
                    <span className="font-semibold">{u.pelaku}</span>{" "}
                    {u.kalimat.map((p, i) =>
                        typeof p === "string" ? (
                            <span key={i}>{p}</span>
                        ) : (
                            <strong key={i} className="font-semibold">
                                {p.tegas}
                            </strong>
                        ),
                    )}
                </p>
                <details className="group mt-1">
                    <summary
                        className="-ml-1 inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-kontrol px-1 text-xs font-semibold text-muted-foreground select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden"
                        aria-label={`Lihat detail: ${kalimatTeks(u)}`}
                    >
                        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
                        <span className="group-open:hidden">Lihat detail</span>
                        <span className="hidden group-open:inline">Tutup detail</span>
                    </summary>
                    <div className="mt-1 flex flex-col gap-3 rounded-kontrol border bg-peran-permukaan-2 p-3 text-sm sm:p-4">
                        <p className="text-xs text-muted-foreground">
                            {u.label} · {KATEGORI_AUDIT[u.kategori].label}
                            {b.olehNip ? ` · NIP ${b.olehNip}` : ""}
                        </p>
                        {u.detail.length > 0 ? (
                            <TabelDetail detail={u.detail} perubahan={adaPerubahan} />
                        ) : (
                            <p className="text-xs text-muted-foreground">Tidak ada rincian tambahan.</p>
                        )}
                        <details className="group/teknis">
                            <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs text-muted-foreground select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                                <ChevronRight
                                    className="size-3 transition-transform group-open/teknis:rotate-90"
                                    aria-hidden
                                />
                                Data teknis
                            </summary>
                            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                                <dt className="text-muted-foreground">Kunci aksi</dt>
                                <dd className="font-mono break-all">{b.aksi}</dd>
                                <dt className="text-muted-foreground">Objek</dt>
                                <dd className="font-mono break-all">
                                    {b.entitas ? `${b.entitas} ${b.entitasId ?? ""}` : "-"}
                                </dd>
                                <dt className="text-muted-foreground">Alamat IP</dt>
                                <dd className="font-mono break-all">{b.ip ?? "-"}</dd>
                            </dl>
                            {u.teknis && (
                                <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-background p-2 font-mono text-[11px] leading-snug break-all whitespace-pre-wrap">
                                    {JSON.stringify(u.teknis, null, 2)}
                                </pre>
                            )}
                        </details>
                    </div>
                </details>
            </div>
        </li>
    );
}

/** Tabel "sebelum → sesudah". Di layar sempit tiap baris jadi tumpukan (tanpa gulir mendatar). */
function TabelDetail({ detail, perubahan }: { detail: Uraian["detail"]; perubahan: boolean }) {
    return (
        <table className="w-full table-fixed border-collapse text-sm" aria-label={perubahan ? "Perubahan" : "Rincian"}>
            <thead className="sr-only sm:not-sr-only">
                <tr className="text-left text-xs text-muted-foreground">
                    <th className="w-1/4 pb-1 font-medium">Bagian</th>
                    {perubahan && <th className="pb-1 font-medium">Sebelumnya</th>}
                    <th className="pb-1 font-medium">{perubahan ? "Sesudahnya" : "Isi"}</th>
                </tr>
            </thead>
            <tbody>
                {detail.map((d, i) => (
                    <tr key={i} className="block border-t py-1.5 sm:table-row sm:py-0">
                        <th
                            scope="row"
                            className="block text-left text-xs font-medium text-muted-foreground sm:table-cell sm:py-1.5 sm:pr-3 sm:align-top"
                        >
                            {d.bidang}
                        </th>
                        {perubahan && (
                            <td className="block break-words sm:table-cell sm:py-1.5 sm:pr-3 sm:align-top">
                                {d.dari !== undefined ? (
                                    <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                                        {d.dari}
                                    </span>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                                <span className="text-muted-foreground sm:hidden" aria-hidden>
                                    {" "}
                                    →
                                </span>
                            </td>
                        )}
                        <td className="block font-medium break-words sm:table-cell sm:py-1.5 sm:align-top">{d.ke}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
