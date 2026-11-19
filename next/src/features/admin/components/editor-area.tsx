"use client";

/**
 * Editor area (PRD "Impor denah", ADR-10): impor GeoJSON → pratinjau → draf; sunting simpul,
 * nama, jenis, unit, area terbatas; tetapkan batas kawasan; setujui poligon; pasangkan aset.
 * Denah asli bersifat rahasia: berkas dibaca di peramban, hanya poligon yang dipilih dikirim.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { Check, FileUp, MapPinned, PenLine, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWaktu } from "@/lib/format";
import { AREA_JENIS, LABEL_AREA_JENIS } from "@/lib/domain/constants";
import { type GeometriArea, type LngLat, tutupCincin, validasiGeometri } from "@/lib/geo/geometri";
import { bacaGeoJson, type FiturImpor } from "@/lib/geo/impor";
import { cn } from "@/lib/utils";
import {
    buangDrafPoligon,
    buatArea,
    hapusArea,
    hapusDrafMassal,
    imporArea,
    jadikanKawasan,
    pasangkanAset,
    pasangkanAsetDalamPoligon,
    setujuiDrafMassal,
    setujuiPoligon,
    simpanDrafPoligon,
    ubahArea,
} from "../actions/area";
import { kalimatDilewati, pilahSetujuiMassal, type PilahSetujui } from "../lib/draf-massal";
import type { AreaEditor, AsetEditor } from "../server/area";
import { PetaArea, type PoligonTampil } from "./peta-area";
import { Bidang, Kartu, Lencana, Pilihan } from "./ui";

type Mode = { jenis: "lihat" } | { jenis: "sunting"; cincin: LngLat[] } | { jenis: "gambar"; titik: LngLat[] } | { jenis: "impor"; fitur: FiturImpor[]; nama: string };

type Hasil = { ok: boolean; pesan?: string };

export function EditorArea({ area, aset, unit }: { area: AreaEditor[]; aset: AsetEditor[]; unit: { id: number; nama: string }[] }) {
    const router = useRouter();
    const [pilihId, setPilihId] = useState<number | null>(null);
    const [mode, setMode] = useState<Mode>({ jenis: "lihat" });
    const [fokus, setFokus] = useState(0);
    const [menunggu, mulai] = useTransition();
    const berkasRef = useRef<HTMLInputElement>(null);

    const pilih = area.find((a) => a.id === pilihId) ?? null;
    const kawasan = area.find((a) => a.jenis === "kawasan") ?? null;

    const jalankan = (kerja: () => Promise<Hasil>, setelah?: () => void) =>
        mulai(async () => {
            const r = await kerja();
            if (r.ok) {
                toast.success(r.pesan ?? "Tersimpan.");
                setelah?.();
                router.refresh();
            } else toast.error(r.pesan ?? "Gagal menyimpan.");
        });

    const poligon: PoligonTampil[] = useMemo(() => {
        if (mode.jenis === "impor") {
            return mode.fitur
                .filter((f) => f.geometry)
                .map((f) => ({ id: `impor-${f.urut}`, nama: f.label ?? `Fitur ${f.urut}`, geometry: f.geometry!, gaya: "impor" as const, draf: true }));
        }
        return area.flatMap((a) => {
            const g = a.polygonDraf ?? a.polygon;
            if (!g) return [];
            return [
                {
                    id: a.id,
                    nama: `${a.nama}${a.polygonDraf ? " (draf)" : ""}`,
                    geometry: g,
                    gaya: a.jenis === "kawasan" ? ("kawasan" as const) : a.restricted ? ("terbatas" as const) : ("area" as const),
                    draf: !!a.polygonDraf,
                },
            ];
        });
    }, [area, mode]);

    const titikAset = useMemo(
        () => aset.filter((a) => a.lat != null && a.lng != null && a.aktif).map((a) => ({ id: a.id, lat: a.lat!, lng: a.lng!, kode: a.kode, terpasang: a.areaId !== null })),
        [aset],
    );

    const bacaBerkas = async (f: File) => {
        if (f.size > 20 * 1024 * 1024) return toast.error("Berkas lebih dari 20 MB.");
        const h = bacaGeoJson(await f.text());
        if (!h.ok) return toast.error(h.pesan);
        setPilihId(null);
        setMode({ jenis: "impor", fitur: h.fitur, nama: f.name });
        setFokus((n) => n + 1);
    };

    // Halaman ini di-stream di balik kerangka muat: berkas yang dipilih sebelum hidrasi selesai
    // (ponsel lambat) tidak memicu onChange. Setelah terpasang, proses berkas yang sudah terpilih.
    useEffect(() => {
        const el = berkasRef.current;
        const f = el?.files?.[0];
        if (!el || !f) return;
        el.value = "";
        void bacaBerkas(f);
    }, []);

    const mulaiSunting = (a: AreaEditor) => {
        const g = a.polygonDraf ?? a.polygon;
        if (!g) return;
        if (g.type !== "Polygon" || g.coordinates.length > 1) {
            return toast.error("Simpul hanya dapat disunting pada poligon tunggal tanpa lubang.");
        }
        setMode({ jenis: "sunting", cincin: g.coordinates[0].slice(0, -1) });
    };

    // Esc melepas pilihan (selain saat menyunting, menggambar, atau ada dialog terbuka).
    useEffect(() => {
        if (pilihId == null || mode.jenis !== "lihat") return;
        const tekan = (e: KeyboardEvent) => {
            if (e.key !== "Escape" || e.defaultPrevented) return;
            if (document.querySelector('[role="alertdialog"], [role="dialog"]')) return;
            setPilihId(null);
        };
        document.addEventListener("keydown", tekan);
        return () => document.removeEventListener("keydown", tekan);
    }, [pilihId, mode.jenis]);

    const geomDari = (c: LngLat[]): GeometriArea => ({ type: "Polygon", coordinates: [tutupCincin(c)] });

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Kartu
                className="min-w-0"
                judul={
                    mode.jenis === "impor"
                        ? `Pratinjau impor: ${mode.nama}`
                        : mode.jenis === "gambar"
                          ? "Klik peta untuk menambah titik poligon baru"
                          : mode.jenis === "sunting"
                            ? "Seret simpul untuk memindahkan. Klik titik tengah untuk menambah, klik ganda simpul untuk menghapus."
                            : `${area.length} area`
                }
                aksi={
                    mode.jenis === "lihat" && (
                        <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => setMode({ jenis: "gambar", titik: [] })}>
                                <Plus aria-hidden /> Gambar area
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => berkasRef.current?.click()}>
                                <FileUp aria-hidden /> Impor GeoJSON
                            </Button>
                            <input
                                ref={berkasRef}
                                type="file"
                                accept=".geojson,.json,application/geo+json,application/json"
                                className="sr-only"
                                aria-label="Berkas GeoJSON"
                                data-testid="berkas-geojson"
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    e.target.value = "";
                                    if (f) void bacaBerkas(f);
                                }}
                            />
                        </div>
                    )
                }
            >
                {area.length === 0 && mode.jenis === "lihat" && (
                    <p className="mb-3 rounded-kontrol bg-muted p-3 text-sm text-muted-foreground">Belum ada poligon. Gambar kawasan galangan lebih dulu.</p>
                )}
                {mode.jenis === "lihat" && pilih && (
                    <div
                        className="mb-2 flex items-center justify-between gap-2 rounded-kontrol border bg-muted/60 px-3 py-1.5 text-sm"
                        data-testid="bilah-terpilih"
                    >
                        <span className="min-w-0 truncate">
                            Terpilih: <strong className="font-medium">{pilih.nama}</strong>
                        </span>
                        <Button variant="outline" size="sm" onClick={() => setPilihId(null)}>
                            <X aria-hidden /> Tutup
                        </Button>
                    </div>
                )}
                <PetaArea
                    poligon={poligon}
                    aset={titikAset}
                    pilihId={pilihId}
                    fokus={fokus}
                    onPilih={(id) => mode.jenis === "lihat" && typeof id === "number" && setPilihId(id)}
                    onLepas={() => mode.jenis === "lihat" && setPilihId(null)}
                    sunting={mode.jenis === "sunting" ? mode.cincin : null}
                    onSunting={(c) => setMode({ jenis: "sunting", cincin: c })}
                    gambar={mode.jenis === "gambar" ? mode.titik : null}
                    onKlikPeta={(p) => mode.jenis === "gambar" && setMode({ jenis: "gambar", titik: [...mode.titik, p] })}
                />
                <Legenda />
            </Kartu>

            <div className="min-w-0 space-y-4">
                {mode.jenis === "impor" && (
                    <PanelImpor
                        fitur={mode.fitur}
                        menunggu={menunggu}
                        batal={() => setMode({ jenis: "lihat" })}
                        impor={(dipilih) =>
                            jalankan(
                                () => imporArea({ fitur: dipilih.map((f) => ({ label: f.label, geometry: f.geometry })) }),
                                () => setMode({ jenis: "lihat" }),
                            )
                        }
                    />
                )}

                {mode.jenis === "gambar" && (
                    <PanelGambar
                        titik={mode.titik}
                        menunggu={menunggu}
                        urungkan={() => setMode({ jenis: "gambar", titik: mode.titik.slice(0, -1) })}
                        batal={() => setMode({ jenis: "lihat" })}
                        simpan={(nama) => {
                            const g = geomDari(mode.titik);
                            const v = validasiGeometri(g);
                            if (!v.sah) return toast.error(v.pesan);
                            jalankan(() => buatArea({ nama, geometry: g }), () => setMode({ jenis: "lihat" }));
                        }}
                    />
                )}

                {mode.jenis === "sunting" && pilih && (
                    <Kartu judul={`Sunting simpul: ${pilih.nama}`}>
                        <p className="mb-3 text-sm text-muted-foreground">{mode.cincin.length} simpul. Perubahan disimpan sebagai draf.</p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="brand"
                                disabled={menunggu}
                                onClick={() => {
                                    const g = geomDari(mode.cincin);
                                    const v = validasiGeometri(g);
                                    if (!v.sah) return toast.error(v.pesan);
                                    jalankan(() => simpanDrafPoligon({ id: pilih.id, geometry: g }), () => setMode({ jenis: "lihat" }));
                                }}
                            >
                                <Check aria-hidden /> Simpan draf
                            </Button>
                            <Button variant="outline" onClick={() => setMode({ jenis: "lihat" })}>
                                Batal
                            </Button>
                        </div>
                    </Kartu>
                )}

                {mode.jenis === "lihat" && pilih && (
                    <PanelArea
                        key={pilih.id}
                        a={pilih}
                        unit={unit}
                        aset={aset}
                        menunggu={menunggu}
                        jalankan={jalankan}
                        tutup={() => setPilihId(null)}
                        sunting={() => mulaiSunting(pilih)}
                    />
                )}

                {mode.jenis === "lihat" && !pilih && (
                    <>
                        <DaftarArea area={area} kawasan={kawasan} pilih={(id) => setPilihId(id)} />
                        <DrafMassal area={area} menunggu={menunggu} jalankan={jalankan} />
                    </>
                )}
            </div>
        </div>
    );
}

function Legenda() {
    const item = (cls: string, label: string) => (
        <li className="flex items-center gap-1.5">
            <span className={cn("inline-block size-3 rounded-sm border-2", cls)} aria-hidden />
            {label}
        </li>
    );
    return (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {item("border-dashed border-muted-foreground", "Kawasan galangan")}
            {item("border-info bg-info/15", "Area disetujui")}
            {item("border-dashed border-info", "Draf")}
            {item("border-danger bg-danger/15", "Area terbatas")}
            <li className="flex items-center gap-1.5" data-testid="legenda-terpilih">
                <span
                    className="inline-block size-3 rounded-sm border-[2.5px] border-(--sorot-peta) bg-(--sorot-peta)/35 shadow-[0_0_0_1.5px_#fff,0_0_0_2.5px_rgb(0_0_0/0.25)]"
                    aria-hidden
                />
                Terpilih
            </li>
            <li className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full bg-chart-3" aria-hidden />
                Aset berarea
            </li>
            <li className="flex items-center gap-1.5">
                <span className="inline-block size-2.5 rounded-full bg-muted-foreground" aria-hidden />
                Aset tanpa area
            </li>
        </ul>
    );
}

/**
 * Baris daftar area yang dirender sebelum dicari atau "Tampilkan semua". Ratusan baris sekaligus
 * membuat halaman Lokasi tertahan ~1 detik di ponsel (gaya dan tata letak ribuan elemen).
 */
const BATAS_DAFTAR = 50;

function DaftarArea({ area, kawasan, pilih }: { area: AreaEditor[]; kawasan: AreaEditor | null; pilih: (id: number) => void }) {
    const [q, setQ] = useState("");
    const [semua, setSemua] = useState(false);
    const cariRef = useRef<HTMLInputElement>(null);
    // Halaman di-stream: teks yang diketik sebelum hidrasi selesai tidak memicu onChange.
    useEffect(() => {
        const awal = cariRef.current?.value;
        if (awal) setQ(awal);
    }, []);
    const cocok = area.filter((a) => !q || `${a.nama} ${a.kode}`.toLowerCase().includes(q.toLowerCase()));
    const tampil = semua || q ? cocok : cocok.slice(0, BATAS_DAFTAR);
    const draf = area.filter((a) => a.polygonDraf).length;
    return (
        <Kartu judul="Area">
            {!kawasan?.polygon && (
                <p className="mb-3 rounded-kontrol bg-warning-soft p-3 text-sm text-warning">
                    Batas kawasan galangan belum disetujui. Tanpa kawasan, gerbang tidak dapat menolak kiriman dari luar galangan.
                </p>
            )}
            {draf > 0 && <p className="mb-3 text-sm text-muted-foreground">{draf} area masih berupa draf dan belum dipakai gerbang.</p>}
            <Input ref={cariRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari area" aria-label="Cari area" className="mb-3" />
            <ul className="max-h-[480px] space-y-1 overflow-y-auto" data-testid="daftar-area">
                {tampil.map((a) => (
                    <li key={a.id}>
                        <button
                            type="button"
                            onClick={() => pilih(a.id)}
                            className="flex w-full items-center justify-between gap-2 rounded-kontrol px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                        >
                            <span className="min-w-0">
                                <span className="block truncate font-medium">{a.nama}</span>
                                <span className="text-xs text-muted-foreground">
                                    {LABEL_AREA_JENIS[a.jenis]} · {a.jumlahAset} aset
                                </span>
                            </span>
                            <span className="flex shrink-0 gap-1">
                                {a.restricted && <Lencana nada="danger">Terbatas</Lencana>}
                                {a.polygonDraf ? <Lencana nada="info">Draf</Lencana> : !a.polygon ? <Lencana>Tanpa poligon</Lencana> : null}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
            {tampil.length < cocok.length && (
                <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setSemua(true)}>
                    Tampilkan semua ({cocok.length} area)
                </Button>
            )}
        </Kartu>
    );
}

/** Draf yang boleh dihapus massal: belum pernah disetujui, bukan kawasan, tanpa aset. Peladen memeriksa ulang. */
function drafTerhapus(a: AreaEditor) {
    return !a.polygon && !!a.polygonDraf && a.jenis !== "kawasan" && a.jumlahAset === 0;
}

/**
 * Kartu "Draf massal": per kumpulan impor (satu impor = satu transaksi = satu waktu dibuat)
 * dan untuk semua draf, setujui atau hapus sekaligus. Angka dihitung dengan aturan yang sama
 * dengan peladen (pilahSetujuiMassal, drafTerhapus); peladen memeriksa ulang.
 */
function DrafMassal({
    area,
    menunggu,
    jalankan,
}: {
    area: AreaEditor[];
    menunggu: boolean;
    jalankan: (k: () => Promise<Hasil>, setelah?: () => void) => void;
}) {
    const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();
    const ringkas = useMemo(() => {
        const draf = area.filter((a) => a.polygonDraf);
        const pilah = (isi: AreaEditor[]) => ({ setujui: pilahSetujuiMassal(isi, area), hapus: isi.filter(drafTerhapus).map((a) => a.id) });
        const per = new Map<string, AreaEditor[]>();
        for (const a of draf) {
            const isi = per.get(a.dibuatPada);
            if (isi) isi.push(a);
            else per.set(a.dibuatPada, [a]);
        }
        const kumpulan = [...per.entries()]
            .sort((x, y) => y[0].localeCompare(x[0]))
            .map(([waktu, isi]) => ({ waktu, isi, ...pilah(isi) }));
        return { jumlah: draf.length, kumpulan, semua: pilah(draf) };
    }, [area]);
    if (ringkas.jumlah === 0) return null;
    const { semua } = ringkas;
    const setujui = async (judul: string, p: PilahSetujui) => {
        const n = p.setujui.length;
        const lewat = kalimatDilewati(p);
        const ya = await konfirmasi({
            judul: `Setujui ${n} poligon?`,
            jumlah: `${n} poligon`,
            isi: (
                <>
                    <p>{`Draf dari ${judul} menjadi poligon resmi dan langsung dipakai gerbang lokasi.`}</p>
                    {lewat && <p data-testid="dilewati">{lewat}</p>}
                </>
            ),
            tombol: `Setujui ${n} poligon`,
        });
        if (ya) jalankan(() => setujuiDrafMassal({ ids: p.setujui }));
    };
    const hapus = async (judul: string, ids: number[]) => {
        const n = ids.length;
        const ya = await konfirmasi({
            judul: `Hapus ${n} draf area?`,
            jumlah: `${n} draf`,
            isi: `Draf dari ${judul} akan dihapus permanen. Area yang sudah disetujui, batas kawasan, dan area berisi aset tidak ikut terhapus.`,
            tombol: `Hapus ${n} draf`,
            bahaya: true,
        });
        if (ya) jalankan(() => hapusDrafMassal({ ids }));
    };
    return (
        <Kartu judul="Draf massal" className="mt-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
            <div data-testid="draf-massal">
                <p className="mb-3 text-sm text-muted-foreground">
                    Setujui atau hapus draf per kumpulan impor. Calon batas kawasan dan poligon tidak sah tidak ikut disetujui. Hapus hanya
                    berlaku untuk draf yang belum pernah disetujui dan tidak berisi aset.
                </p>
                <ul className="mb-3 space-y-1">
                    {ringkas.kumpulan.map((k) => (
                        <li key={k.waktu} className="rounded-kontrol px-2 py-1.5 text-sm transition-colors hover:bg-muted">
                            <span className="block font-medium">Dibuat {formatWaktu(k.waktu)}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                                {k.isi.length} draf · {k.isi.slice(0, 3).map((a) => a.nama).join(", ")}
                                {k.isi.length > 3 ? ", …" : ""}
                            </span>
                            <span className="mt-1.5 flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={menunggu || k.setujui.setujui.length === 0}
                                    onClick={() => setujui(`kumpulan ${formatWaktu(k.waktu)}`, k.setujui)}
                                >
                                    <Check aria-hidden /> Setujui {k.setujui.setujui.length}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={menunggu || k.hapus.length === 0}
                                    onClick={() => hapus(`kumpulan ${formatWaktu(k.waktu)}`, k.hapus)}
                                >
                                    <Trash2 aria-hidden /> Hapus {k.hapus.length}
                                </Button>
                            </span>
                        </li>
                    ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                    <Button variant="brand" size="sm" disabled={menunggu || semua.setujui.setujui.length === 0} onClick={() => setujui("semua kumpulan", semua.setujui)}>
                        <Check aria-hidden /> Setujui semua draf ({semua.setujui.setujui.length})
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        disabled={menunggu || semua.hapus.length === 0}
                        onClick={() => hapus("semua draf", semua.hapus)}
                    >
                        <Trash2 aria-hidden /> Hapus semua draf ({semua.hapus.length})
                    </Button>
                </div>
            </div>
            {dialogKonfirmasi}
        </Kartu>
    );
}

function PanelArea({
    a,
    unit,
    aset,
    menunggu,
    jalankan,
    tutup,
    sunting,
}: {
    a: AreaEditor;
    unit: { id: number; nama: string }[];
    aset: AsetEditor[];
    menunggu: boolean;
    jalankan: (k: () => Promise<Hasil>, setelah?: () => void) => void;
    tutup: () => void;
    sunting: () => void;
}) {
    const [nama, setNama] = useState(a.nama);
    const [kode, setKode] = useState(a.kode);
    const [jenis, setJenis] = useState(a.jenis === "kawasan" ? "gedung" : a.jenis);
    const [divisionId, setDivisionId] = useState<number | null>(a.divisionId);
    const [restricted, setRestricted] = useState(a.restricted);
    const [tambah, setTambah] = useState<string>("");
    const diArea = aset.filter((x) => x.areaId === a.id);
    const tanpaArea = aset.filter((x) => x.areaId !== a.id && x.aktif);
    const isKawasan = a.jenis === "kawasan";
    const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();

    return (
        <Kartu
            judul={a.nama}
            aksi={
                <Button variant="ghost" size="icon-sm" onClick={tutup} aria-label="Tutup">
                    <X aria-hidden />
                </Button>
            }
        >
            <div className="space-y-5" data-testid="panel-area">
                <div className="flex flex-wrap gap-1.5">
                    <Lencana nada={isKawasan ? "muted" : "info"}>{LABEL_AREA_JENIS[a.jenis]}</Lencana>
                    {a.polygon ? <Lencana nada="success">Poligon disetujui</Lencana> : <Lencana>Belum disetujui</Lencana>}
                    {a.polygonDraf && <Lencana nada="info">Ada draf</Lencana>}
                </div>

                <section className="space-y-2">
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Poligon</h3>
                    <div className="flex flex-wrap gap-2">
                        {(a.polygonDraf || a.polygon) && (
                            <Button variant="outline" size="sm" onClick={sunting}>
                                <PenLine aria-hidden /> Sunting simpul
                            </Button>
                        )}
                        {a.polygonDraf && (
                            <>
                                <Button
                                    variant="brand"
                                    size="sm"
                                    disabled={menunggu}
                                    onClick={async () => {
                                        const ya = await konfirmasi({
                                            judul: `Setujui poligon "${a.nama}"?`,
                                            isi: "Mulai inspeksi berikutnya, gerbang lokasi memakai poligon ini untuk aset di area ini. Poligon lama (bila ada) diganti.",
                                            tombol: "Setujui poligon",
                                        });
                                        if (ya) jalankan(() => setujuiPoligon({ id: a.id }));
                                    }}
                                >
                                    <Check aria-hidden /> Setujui poligon
                                </Button>
                                <Button variant="ghost" size="sm" disabled={menunggu} onClick={() => jalankan(() => buangDrafPoligon({ id: a.id }))}>
                                    <Undo2 aria-hidden /> Buang draf
                                </Button>
                            </>
                        )}
                    </div>
                    {!isKawasan && (
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={menunggu}
                            onClick={async () => {
                                const ya = await konfirmasi({
                                    judul: `Jadikan "${a.nama}" batas kawasan galangan?`,
                                    isi: "Kiriman inspeksi dari luar batas ini akan ditolak. Batas kawasan yang lama dinonaktifkan (tidak dihapus).",
                                    tombol: "Jadikan batas kawasan",
                                });
                                if (ya) jalankan(() => jadikanKawasan({ id: a.id }));
                            }}
                        >
                            <MapPinned aria-hidden /> Jadikan batas kawasan
                        </Button>
                    )}
                </section>

                <form
                    className="space-y-3"
                    onSubmit={(e) => {
                        e.preventDefault();
                        jalankan(() => ubahArea({ id: a.id, nama, kode, jenis, divisionId, restricted }));
                    }}
                >
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Atribut</h3>
                    <Bidang label="Nama" htmlFor="area-nama">
                        <Input id="area-nama" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={120} />
                    </Bidang>
                    <Bidang label="Kode" htmlFor="area-kode">
                        <Input id="area-kode" value={kode} onChange={(e) => setKode(e.target.value)} required maxLength={32} />
                    </Bidang>
                    {!isKawasan && (
                        <Bidang label="Jenis" htmlFor="area-jenis">
                            <Pilihan id="area-jenis" value={jenis} onChange={(e) => setJenis(e.target.value as typeof jenis)}>
                                {AREA_JENIS.filter((j) => j !== "kawasan").map((j) => (
                                    <option key={j} value={j}>
                                        {LABEL_AREA_JENIS[j]}
                                    </option>
                                ))}
                            </Pilihan>
                        </Bidang>
                    )}
                    <Bidang label="Unit kerja" htmlFor="area-unit">
                        <Pilihan id="area-unit" value={divisionId ?? ""} onChange={(e) => setDivisionId(e.target.value ? Number(e.target.value) : null)}>
                            <option value="">Tidak ada</option>
                            {unit.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.nama}
                                </option>
                            ))}
                        </Pilihan>
                    </Bidang>
                    {!isKawasan && (
                        <label className="flex items-start gap-2 text-sm">
                            <Checkbox className="mt-0.5" checked={restricted} onCheckedChange={(v) => setRestricted(v === true)} />
                            <span>
                                Area terbatas
                                <span className="block text-xs text-muted-foreground">Foto tidak diminta; inspeksi otomatis masuk antrean tinjauan.</span>
                            </span>
                        </label>
                    )}
                    <Button type="submit" variant="outline" disabled={menunggu}>
                        <Pencil aria-hidden /> Simpan atribut
                    </Button>
                </form>

                {!isKawasan && (
                    <section className="space-y-2">
                        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Aset di area ini ({diArea.length})</h3>
                        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm" data-testid="aset-area">
                            {diArea.map((x) => (
                                <li key={x.id} className="flex items-center justify-between gap-2">
                                    <span className="min-w-0 truncate">
                                        <span className="font-medium">{x.kode}</span> <span className="text-muted-foreground">{x.tipe}</span>
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="xs"
                                        disabled={menunggu}
                                        onClick={() => jalankan(() => pasangkanAset({ areaId: null, assetIds: [x.id] }))}
                                    >
                                        Lepas
                                    </Button>
                                </li>
                            ))}
                        </ul>
                        <div className="flex gap-2">
                            <Pilihan aria-label="Aset untuk dipasangkan" value={tambah} onChange={(e) => setTambah(e.target.value)}>
                                <option value="">Pilih aset…</option>
                                {tanpaArea.map((x) => (
                                    <option key={x.id} value={x.id}>
                                        {x.kode} · {x.tipe}
                                        {x.areaId ? "" : " (tanpa area)"}
                                    </option>
                                ))}
                            </Pilihan>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={!tambah || menunggu}
                                onClick={() => jalankan(() => pasangkanAset({ areaId: a.id, assetIds: [Number(tambah)] }), () => setTambah(""))}
                            >
                                Pasangkan
                            </Button>
                        </div>
                        {(a.polygon || a.polygonDraf) && (
                            <Button variant="outline" size="sm" disabled={menunggu} onClick={() => jalankan(() => pasangkanAsetDalamPoligon({ id: a.id }))}>
                                Pasangkan aset yang titiknya di dalam poligon
                            </Button>
                        )}
                    </section>
                )}

                <Button
                    variant="destructive"
                    size="sm"
                    disabled={menunggu}
                    onClick={async () => {
                        const ya = await konfirmasi({
                            judul: `Hapus area "${a.nama}"?`,
                            jumlah: diArea.length ? `${diArea.length} aset akan dilepas dari area ini` : undefined,
                            isi: "Area dan poligonnya dihapus permanen. Aset di dalamnya tidak terhapus, hanya menjadi belum berarea.",
                            tombol: "Hapus area",
                            bahaya: true,
                        });
                        if (ya) jalankan(() => hapusArea({ id: a.id }), tutup);
                    }}
                >
                    <Trash2 aria-hidden /> Hapus area
                </Button>
            </div>
            {dialogKonfirmasi}
        </Kartu>
    );
}

function PanelImpor({
    fitur,
    menunggu,
    batal,
    impor,
}: {
    fitur: FiturImpor[];
    menunggu: boolean;
    batal: () => void;
    impor: (f: FiturImpor[]) => void;
}) {
    const sah = fitur.filter((f) => f.geometry);
    const galat = fitur.filter((f) => f.galat);
    return (
        <Kartu judul="Pratinjau impor">
            <div className="space-y-3" data-testid="panel-impor">
                <p className="text-sm">
                    <span className="font-semibold">{sah.length}</span> poligon siap diimpor
                    {galat.length > 0 && (
                        <>
                            , <span className="font-semibold text-danger">{galat.length}</span> dilewati
                        </>
                    )}
                    . Semua masuk sebagai draf; gerbang baru memakainya setelah disetujui.
                </p>
                <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
                    {fitur.map((f) => (
                        <li key={f.urut} className="flex items-start justify-between gap-2">
                            <span className={cn("min-w-0 truncate", !f.label && "text-muted-foreground italic")}>{f.label ?? `Tanpa label (#${f.urut})`}</span>
                            {f.galat && <span className="shrink-0 text-xs text-danger">{f.galat}</span>}
                        </li>
                    ))}
                </ul>
                <div className="flex gap-2">
                    <Button variant="brand" disabled={!sah.length || menunggu} onClick={() => impor(sah)}>
                        Impor {sah.length} poligon
                    </Button>
                    <Button variant="outline" onClick={batal}>
                        Batal
                    </Button>
                </div>
            </div>
        </Kartu>
    );
}

function PanelGambar({
    titik,
    menunggu,
    urungkan,
    batal,
    simpan,
}: {
    titik: LngLat[];
    menunggu: boolean;
    urungkan: () => void;
    batal: () => void;
    simpan: (nama: string) => void;
}) {
    const [nama, setNama] = useState("");
    return (
        <Kartu judul="Area baru">
            <form
                className="space-y-3"
                onSubmit={(e) => {
                    e.preventDefault();
                    simpan(nama.trim());
                }}
            >
                <p className="text-sm text-muted-foreground">{titik.length} titik. Sedikitnya tiga titik.</p>
                <Bidang label="Nama area" htmlFor="area-baru-nama">
                    <Input id="area-baru-nama" value={nama} onChange={(e) => setNama(e.target.value)} required maxLength={120} />
                </Bidang>
                <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="brand" disabled={titik.length < 3 || !nama.trim() || menunggu}>
                        Simpan sebagai draf
                    </Button>
                    <Button type="button" variant="outline" disabled={!titik.length} onClick={urungkan}>
                        <Undo2 aria-hidden /> Urungkan titik
                    </Button>
                    <Button type="button" variant="ghost" onClick={batal}>
                        Batal
                    </Button>
                </div>
            </form>
        </Kartu>
    );
}
