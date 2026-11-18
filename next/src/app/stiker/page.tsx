import type { Metadata } from "next";
import { headers } from "next/headers";
import { Info, Printer, ScanLine } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { IkonModul } from "@/features/admin/components/ikon-modul";
import { SaringStiker } from "@/features/admin/components/saring-stiker";
import { TombolCetak } from "@/features/admin/components/tombol-cetak";
import { Kosong } from "@/features/admin/components/ui";
import {
    TATA_LETAK,
    bagiLembar,
    cssStiker,
    parseSaringStiker,
    parseTata,
    type KodeTata,
} from "@/features/admin/lib/stiker";
import { catatAudit } from "@/features/admin/server/aksi";
import { asetStiker, pilihanStiker, qrSvg, tokenTercetak } from "@/features/admin/server/stiker";
import { db } from "@/db";
import { requireRole } from "@/lib/auth/guards";
import { formatAngka } from "@/lib/format";
import { labelLokasi } from "@/lib/domain/label-aset";

export const metadata: Metadata = { title: "Lembar Stiker QR" };

const PILIHAN_TATA = (Object.keys(TATA_LETAK) as KodeTata[]).map((kode) => ({ kode, nama: TATA_LETAK[kode].nama }));

/**
 * Lembar stiker QR untuk dicetak lewat dialog cetak peramban (SPEC §4.4, L7). Bukan PDF: pengelola
 * stiker perlu pratinjau dan memilih rentang halaman sendiri tanpa selisih milimeter.
 */
export default async function LembarStiker({ searchParams }: PageProps<"/stiker">) {
    const user = await requireRole("admin");
    const sp = await searchParams;
    const kodeTata = parseTata(typeof sp.tata === "string" ? sp.tata : undefined);
    const tata = TATA_LETAK[kodeTata];
    const filter = parseSaringStiker(sp);

    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
    const proto =
        h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    const origin = `${proto}://${host}`;

    const [aset, pilihan] = await Promise.all([asetStiker(filter), pilihanStiker()]);
    const label = await Promise.all(aset.map(async (a) => ({ ...a, svg: await qrSvg(origin, a.qrToken) })));
    const lembar = bagiLembar(label, tata.kolom * tata.baris);
    // Membuka lembar = melihat token semua aset terpilih: dicatat.
    await catatAudit(db, user, "stiker.lihat", "asset", "-", { jumlah: aset.length, tata: kodeTata, ...filter });

    const perJenis = pilihan.tipe
        .map((t) => ({ ...t, n: aset.filter((a) => a.slug === t.slug).length }))
        .filter((t) => t.n > 0);

    return (
        <>
            <style>{cssStiker(kodeTata)}</style>
            <div className="stiker-layar">
                <PageHeader
                    title="Lembar stiker QR"
                    description="Pilih aset, periksa pratinjau, lalu cetak di kertas label A4."
                    actions={<TombolCetak />}
                />
                <SaringStiker
                    key={JSON.stringify([kodeTata, filter])}
                    tata={kodeTata}
                    nilai={filter}
                    pilihan={{ tata: PILIHAN_TATA, ...pilihan }}
                />
                <div
                    className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
                    aria-live="polite"
                    data-testid="ringkasan-stiker"
                >
                    <p>
                        <strong className="font-semibold tabular-nums">{formatAngka(aset.length)}</strong> stiker
                        <span className="text-muted-foreground"> · </span>
                        <strong className="font-semibold tabular-nums">{formatAngka(lembar.length)}</strong> lembar A4
                    </p>
                    {perJenis.length > 0 && (
                        <ul className="flex flex-wrap gap-1.5" aria-label="Jumlah per jenis objek">
                            {perJenis.map((t) => (
                                <li
                                    key={t.slug}
                                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                >
                                    <IkonModul slug={t.slug} className="size-3.5" />
                                    {t.nama}
                                    <span className="font-semibold text-foreground tabular-nums">{t.n}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {lembar.length === 0 ? (
                <div className="stiker-layar">
                    <Kosong>Tidak ada aset yang cocok dengan saringan. Longgarkan saringan di atas.</Kosong>
                </div>
            ) : (
                <section
                    aria-label="Pratinjau cetak"
                    className="stiker-pratinjau overflow-x-auto rounded-xl border bg-muted/60 p-3 sm:p-6"
                >
                    <div className="stiker-layar mb-4 flex flex-wrap items-start gap-x-6 gap-y-2 text-xs text-muted-foreground">
                        <p className="inline-flex items-center gap-1.5 font-medium text-foreground">
                            <Printer className="size-3.5" aria-hidden /> Pratinjau cetak · A4 potret · {tata.nama}
                        </p>
                        <p className="inline-flex max-w-[70ch] items-start gap-1.5">
                            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                            <span>
                                Pada dialog cetak pilih Ukuran asli (100%) agar label tidak bergeser. Tempel stiker di
                                dinding tepat di atas dudukan objek, bukan pada badan tabung: tabung bisa dipindah
                                atau ditukar saat isi ulang, titik pemasangan tetap.
                            </span>
                        </p>
                    </div>
                    <div className="stiker-pratinjau-isi">
                        {lembar.map((isi, i) => (
                            <section key={i} className="stiker-lembar" aria-label={`Lembar ${i + 1}`}>
                                {isi.map((a) => (
                                    <div key={a.id} className="stiker-label" data-kode={a.kode}>
                                        {/* SVG dibuat peladen oleh pustaka qrcode dari URL /i/{token}; tidak memuat masukan pengguna. */}
                                        <div className="stiker-qr" dangerouslySetInnerHTML={{ __html: a.svg }} />
                                        <div className="stiker-teks">
                                            <div className="stiker-jenis">
                                                <IkonModul slug={a.slug} />
                                                {a.tipe || "Objek K3"}
                                            </div>
                                            <div className="stiker-kode">{a.kode}</div>
                                            {(a.area || a.gedung) && (
                                                <div className="stiker-area">{a.area || a.gedung}</div>
                                            )}
                                            <div className="stiker-lokasi">{labelLokasi(a)}</div>
                                            <div className="stiker-perintah">
                                                <ScanLine aria-hidden />
                                                Pindai sebelum memeriksa
                                            </div>
                                            <div className="stiker-token">{tokenTercetak(a.qrToken)}</div>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}
