"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PesanMuncul } from "@/components/ui/pesan-muncul";
import { Textarea } from "@/components/ui/textarea";
import { useFormAksi } from "@/features/admin/components/use-form-aksi";
import { HASIL_TINJAUAN, LABEL_HASIL_TINJAUAN, type HasilTinjauan } from "@/lib/domain/constants";
import { cn } from "@/lib/utils";
import { putuskanTinjauan } from "./aksi";

/** Pilihan Diterima / Ditolak dengan catatan wajib (PRD F13). */
export function FormPutusan({ id }: { id: string }) {
    const router = useRouter();
    const [hasil, setHasil] = useState<HasilTinjauan | null>(null);
    const { state, onSubmit, menunggu } = useFormAksi(putuskanTinjauan, { setelahBerhasil: () => router.refresh() });
    const galat = state && !state.ok ? (Object.values(state.galat ?? {}).flat()[0] ?? state.pesan) : undefined;
    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Keputusan tinjauan">
            <input type="hidden" name="id" value={id} />
            <fieldset className="grid grid-cols-2 gap-2">
                <legend className="mb-1.5 text-sm font-medium">Hasil tinjauan</legend>
                {HASIL_TINJAUAN.map((h) => (
                    <label
                        key={h}
                        className={cn(
                            "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-sm font-medium transition-colors duration-200 ease-out",
                            hasil === h
                                ? h === "diterima"
                                    ? "border-success bg-success-soft text-success"
                                    : "border-danger bg-danger-soft text-danger"
                                : "bg-card hover:bg-muted",
                        )}
                    >
                        <input
                            type="radio"
                            name="hasil"
                            value={h}
                            className="sr-only"
                            checked={hasil === h}
                            onChange={() => setHasil(h)}
                        />
                        {LABEL_HASIL_TINJAUAN[h]}
                    </label>
                ))}
            </fieldset>
            <label htmlFor="catatanReview" className="text-sm font-medium">
                Catatan tinjauan
            </label>
            <Textarea
                id="catatanReview"
                name="catatanReview"
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                placeholder="Mis. posisi di pintu bengkel, sinyal GPS terhalang atap baja; foto cocok dengan aset."
            />
            <PesanMuncul role="alert" pesan={galat} celah="0.25rem" isiClassName="text-sm text-danger" />
            <Button type="submit" disabled={menunggu || !hasil} className="self-end">
                {menunggu ? "Menyimpan…" : "Simpan tinjauan"}
            </Button>
        </form>
    );
}
