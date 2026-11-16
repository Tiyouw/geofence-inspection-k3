"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { cari } from "../actions/pencarian";
import type { KelompokCari } from "../lib/pencarian";

const JEDA_MS = 250;

/**
 * Pencarian Ctrl+K / Cmd+K (K1-K3). `/` sengaja tidak dibajak: dipakai untuk mengetik di kolom.
 * Saran dimuat saat dibuka; tidak pernah membuka sendiri.
 */
export function PencarianPerintah() {
    const router = useRouter();
    const [buka, setBuka] = useState(false);
    const [q, setQ] = useState("");
    const [hasil, setHasil] = useState<KelompokCari[]>([]);
    const [memuat, mulai] = useTransition();
    const urutan = useRef(0);

    useEffect(() => {
        const tekan = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                setBuka((b) => !b);
            }
        };
        window.addEventListener("keydown", tekan);
        return () => window.removeEventListener("keydown", tekan);
    }, []);

    useEffect(() => {
        if (!buka) return;
        const nomor = ++urutan.current;
        const t = setTimeout(() => {
            mulai(async () => {
                const r = await cari(q);
                if (nomor === urutan.current) setHasil(r);
            });
        }, JEDA_MS);
        return () => clearTimeout(t);
    }, [q, buka]);

    const pergi = (href: string) => {
        setBuka(false);
        setQ("");
        router.push(href);
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setBuka(true)}
                className="flex h-9 w-full max-w-sm items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground hover:bg-muted"
            >
                <Search className="size-4" aria-hidden />
                <span className="flex-1 text-left">Cari aset, temuan, inspeksi…</span>
                <kbd className="rounded border bg-muted px-1.5 font-mono text-[11px]">Ctrl K</kbd>
            </button>
            <CommandDialog
                open={buka}
                onOpenChange={setBuka}
                title="Pencarian"
                description="Cari halaman, aset, temuan, atau inspeksi"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Ketik minimal 2 huruf…"
                        value={q}
                        onValueChange={setQ}
                        aria-label="Kata pencarian"
                    />
                    <CommandList>
                        <CommandEmpty>{memuat ? "Mencari…" : "Tidak ada hasil."}</CommandEmpty>
                        {hasil.map((g) => (
                            <CommandGroup key={g.nama} heading={g.nama}>
                                {g.hasil.map((h) => (
                                    <CommandItem
                                        key={g.nama + h.href + h.judul}
                                        value={g.nama + h.href + h.judul}
                                        onSelect={() => pergi(h.href)}
                                    >
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate">{h.judul}</span>
                                            {h.rincian && (
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {h.rincian}
                                                </span>
                                            )}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </CommandDialog>
        </>
    );
}
