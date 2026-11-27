"use client";

import { MapPinOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { taruhAsetDiArea } from "../actions/taruh-aset";
import type { LuarKawasan } from "../lib/dasbor";

/**
 * Aset yang koordinatnya di luar kawasan galangan: tidak digambar di peta (bukan posisi sah),
 * tetapi didaftar dengan jalan memperbaikinya.
 */
export function AsetLuarKawasan({ aset, bisaDitaruh }: { aset: LuarKawasan[]; bisaDitaruh: number[] }) {
    const [konfirmasi, dialog] = useKonfirmasi();
    const [menunggu, mulai] = useTransition();
    const router = useRouter();
    if (!aset.length) return null;
    const bisa = new Set(bisaDitaruh);
    return (
        <details className="group mt-3 rounded-kontrol border border-warning/40 bg-warning-soft p-3 text-sm" data-testid="luar-kawasan">
            <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-warning [&::-webkit-details-marker]:hidden">
                <MapPinOff className="size-4 shrink-0" aria-hidden />
                {aset.length} aset: koordinat di luar kawasan
                <span className="ml-auto text-xs font-normal text-foreground/70 group-open:hidden">Lihat</span>
            </summary>
            <p className="mt-2 text-foreground/80">
                Titiknya tidak digambar karena jatuh di luar batas kawasan galangan (data lama atau salah ketik). Taruh di dalam poligon
                area-nya, atau atur titiknya satu per satu.
            </p>
            {bisa.size > 0 && (
                <Button
                    size="sm"
                    className="mt-2"
                    disabled={menunggu}
                    onClick={async () => {
                        const ya = await konfirmasi({
                            judul: "Taruh aset di dalam area-nya?",
                            jumlah: `${bisa.size} aset`,
                            isi: "Titik aset dipindah ke tengah poligon area yang sudah disetujui. Sesuaikan lagi di halaman aset bila perlu.",
                            tombol: "Taruh",
                        });
                        if (!ya) return;
                        mulai(async () => {
                            const r = await taruhAsetDiArea({ assetIds: [...bisa] });
                            if (r.ok) toast.success(r.pesan ?? "Tersimpan.");
                            else toast.error(r.pesan);
                            router.refresh();
                        });
                    }}
                >
                    Taruh {bisa.size} aset di poligon area-nya
                </Button>
            )}
            <ul className="mt-3 grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                {aset.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 rounded bg-card px-2 py-1.5">
                        <span className="min-w-0 truncate">
                            <b>{a.kode}</b> <span className="text-muted-foreground">· {a.area}</span>
                        </span>
                        <Link href={`/admin/aset/${a.id}`} className="shrink-0 text-xs font-semibold underline underline-offset-2">
                            {bisa.has(a.id) ? "Atur" : "Atur titik"}
                        </Link>
                    </li>
                ))}
            </ul>
            {dialog}
        </details>
    );
}
