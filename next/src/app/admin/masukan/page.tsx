import type { Metadata } from "next";
import Link from "next/link";
import { Download, ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Kosong, Lencana } from "@/features/admin/components/ui";
import type { Nada } from "@/features/admin/lib/label";
import { LABEL_JENIS_MASUKAN, type JenisMasukan } from "@/features/masukan/jenis";
import { daftarMasukan } from "@/features/masukan/server";
import { TombolSelesai } from "@/features/masukan/tombol-selesai";
import { requireRole } from "@/lib/auth/guards";
import { formatWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Masukan panduan" };

const NADA_JENIS: Record<JenisMasukan, Nada> = { bug: "danger", aneh: "warning", tanya: "info", saran: "success" };

/** Masukan klien dari /panduan: dibaca, diekspor CSV, dan ditandai selesai. */
export default async function HalamanMasukan({ searchParams }: PageProps<"/admin/masukan">) {
    await requireRole("admin");
    const semua = (await searchParams).semua === "1";
    const rows = await daftarMasukan({ semua });
    return (
        <>
            <PageHeader
                title="Masukan panduan"
                description="Catatan klien saat mencoba aplikasi lewat halaman /panduan. Masukan baru muncul sendiri tanpa memuat ulang."
                actions={
                    <Button variant="outline" asChild>
                        <a href="/admin/masukan/ekspor" download>
                            <Download className="size-4" aria-hidden /> Ekspor CSV
                        </a>
                    </Button>
                }
            />
            <nav aria-label="Saring masukan" className="mb-4 flex gap-2 text-sm">
                {[
                    { href: "/admin/masukan", label: "Belum selesai", aktif: !semua },
                    { href: "/admin/masukan?semua=1", label: "Semua", aktif: semua },
                ].map((t) => (
                    <Link
                        key={t.href}
                        href={t.href}
                        aria-current={t.aktif ? "page" : undefined}
                        className={cn(
                            "rounded-full border px-3 py-1.5 font-semibold",
                            t.aktif ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground",
                        )}
                    >
                        {t.label}
                    </Link>
                ))}
            </nav>
            {rows.length === 0 ? (
                <Kosong>{semua ? "Belum ada masukan." : "Semua masukan sudah ditangani."}</Kosong>
            ) : (
                <ul className="grid gap-3" data-testid="daftar-masukan">
                    {rows.map((m) => (
                        <li key={m.id} className={cn("rounded-kartu border bg-card p-4 sm:p-5", m.selesai && "opacity-70")}>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Lencana nada={NADA_JENIS[m.jenis as JenisMasukan] ?? "muted"}>
                                    {LABEL_JENIS_MASUKAN[m.jenis as JenisMasukan] ?? m.jenis}
                                </Lencana>
                                {m.konteks && <span className="font-semibold">{m.konteks}</span>}
                                <span className="text-muted-foreground">
                                    · {m.nama} · {formatWaktu(m.createdAt)}
                                </span>
                                {m.selesai && <Lencana nada="success">Selesai</Lencana>}
                            </div>
                            <p className="mt-2 max-w-[75ch] text-[15px] leading-relaxed whitespace-pre-wrap">{m.isi}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                {m.storageKey && (
                                    <a
                                        href={`/api/masukan/${m.id}/gambar`}
                                        target="_blank"
                                        rel="noopener"
                                        className="inline-flex items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                                    >
                                        <ImageIcon className="size-4" aria-hidden /> Lihat tangkapan layar
                                    </a>
                                )}
                                <TombolSelesai id={m.id} selesai={m.selesai} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}
