"use client";

/**
 * Saringan jejak audit: berlaku seketika saat diubah (tanpa tombol "Terapkan"), lewat query
 * string supaya tautan bisa dibagikan dan tombol Kembali tetap bekerja. Tanpa JS formulir GET
 * biasa dengan tombol di <noscript>.
 *
 * Pilihan memakai <select> asli (Pilihan); komponen Select rancangan sesi A bisa menggantikannya
 * di satu tempat ini tanpa mengubah perilaku.
 */
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useTransition, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { Pilihan } from "./ui";
import type { KategoriAudit } from "../lib/audit";

type Props = {
    nilai: { kategori?: string; pengguna?: string; dari?: string; sampai?: string };
    kategori: { nilai: KategoriAudit; label: string }[];
    pengguna: { id: number; nama: string }[];
};

export function SaringAudit({ nilai, kategori, pengguna }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const [menunggu, mulai] = useTransition();

    function terapkan(form: HTMLFormElement) {
        const q = new URLSearchParams();
        for (const [k, v] of new FormData(form)) if (typeof v === "string" && v) q.set(k, v);
        const s = q.toString();
        mulai(() => router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false }));
    }

    // Pilihan yang diubah sebelum halaman selesai dimuat (ponsel lambat) tidak memicu onChange:
    // setelah hidrasi, terapkan bila isi formulir berbeda dari URL.
    const formRef = useRef<HTMLFormElement>(null);
    useEffect(() => {
        const form = formRef.current;
        if (!form) return;
        const isi = new FormData(form);
        const beda = (["kategori", "pengguna", "dari", "sampai"] as const).some(
            (k) => (isi.get(k) || "") !== (nilai[k] ?? ""),
        );
        if (beda) terapkan(form);
        // Hanya sekali saat dipasang; formulir dipasang ulang (key) tiap saringan berubah.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const aktif = Object.values(nilai).some(Boolean);
    const label = "flex min-w-0 flex-col gap-1 text-xs font-medium";

    return (
        <form
            ref={formRef}
            method="get"
            aria-label="Saring jejak"
            aria-busy={menunggu}
            onChange={(e) => terapkan(e.currentTarget)}
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                terapkan(e.currentTarget);
            }}
            className="mb-5 grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
        >
            <label className={label}>
                Jenis kegiatan
                <Pilihan name="kategori" defaultValue={nilai.kategori ?? ""}>
                    <option value="">Semua kegiatan</option>
                    {kategori.map((k) => (
                        <option key={k.nilai} value={k.nilai}>
                            {k.label}
                        </option>
                    ))}
                </Pilihan>
            </label>
            <label className={label}>
                Dilakukan oleh
                <Pilihan name="pengguna" defaultValue={nilai.pengguna ?? ""}>
                    <option value="">Siapa saja</option>
                    {pengguna.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.nama}
                        </option>
                    ))}
                </Pilihan>
            </label>
            <label className={label}>
                Dari tanggal
                <input
                    type="date"
                    name="dari"
                    defaultValue={nilai.dari ?? ""}
                    max={nilai.sampai}
                    className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
            </label>
            <label className={label}>
                Sampai tanggal
                <input
                    type="date"
                    name="sampai"
                    defaultValue={nilai.sampai ?? ""}
                    min={nilai.dari}
                    className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
            </label>
            <div className="flex h-8 items-center gap-3 text-xs">
                {menunggu && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground" role="status">
                        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Memuat…
                    </span>
                )}
                {aktif && !menunggu && (
                    <Link
                        href={pathname}
                        replace
                        scroll={false}
                        className="inline-flex items-center gap-1 rounded font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                        <X className="size-3.5" aria-hidden /> Hapus saringan
                    </Link>
                )}
                <noscript>
                    <button type="submit" className="rounded-lg border px-3 py-1.5 text-sm">
                        Terapkan
                    </button>
                </noscript>
            </div>
        </form>
    );
}
