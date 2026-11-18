"use client";

import { useState } from "react";
import { CapFoto } from "@/components/foto/cap-foto";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { DataCap } from "@/lib/foto/cap";

/**
 * Galeri foto bukti (F5, SPEC §9 celah #1). Gambar dimuat dari /api/foto/{id}, yang memeriksa
 * sesi dan peran; tidak ada URL blob di halaman. <img> biasa dipakai karena rute itu bersesi
 * (next/image akan mengambilnya tanpa cookie pengguna).
 */
export function GaleriFoto({ foto }: { foto: { id: string; keterangan: string; cap?: DataCap }[] }) {
    const [buka, setBuka] = useState<number | null>(null);
    if (foto.length === 0) return <p className="text-sm text-muted-foreground">Belum ada foto.</p>;
    const aktif = buka !== null ? foto[buka] : null;
    return (
        <>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {foto.map((f, i) => (
                    <li key={f.id}>
                        <button
                            type="button"
                            onClick={() => setBuka(i)}
                            className="relative block aspect-square w-full overflow-hidden rounded-lg border bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={`/api/foto/${f.id}`}
                                alt={`Foto bukti ${i + 1}, ${f.keterangan}`}
                                loading="lazy"
                                className="size-full object-cover"
                            />
                            {f.cap && <CapFoto data={f.cap} ringkas />}
                        </button>
                    </li>
                ))}
            </ul>
            <Dialog open={buka !== null} onOpenChange={(o) => !o && setBuka(null)}>
                <DialogContent className="max-w-4xl sm:max-w-4xl">
                    <DialogTitle>
                        Foto {buka !== null ? buka + 1 : ""} dari {foto.length}
                    </DialogTitle>
                    {aktif && (
                        <figure>
                            <div className="relative overflow-hidden rounded-lg bg-black">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={`/api/foto/${aktif.id}`}
                                    alt={`Foto bukti ${buka! + 1}`}
                                    className="max-h-[75vh] w-full object-contain"
                                />
                                {aktif.cap && <CapFoto data={aktif.cap} />}
                            </div>
                            <figcaption className="mt-2 text-sm text-muted-foreground">{aktif.keterangan}</figcaption>
                        </figure>
                    )}
                    {foto.length > 1 && (
                        <div className="flex justify-between">
                            <button
                                type="button"
                                className="text-sm underline"
                                onClick={() => setBuka((b) => ((b ?? 0) - 1 + foto.length) % foto.length)}
                            >
                                Sebelumnya
                            </button>
                            <button
                                type="button"
                                className="text-sm underline"
                                onClick={() => setBuka((b) => ((b ?? 0) + 1) % foto.length)}
                            >
                                Berikutnya
                            </button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
