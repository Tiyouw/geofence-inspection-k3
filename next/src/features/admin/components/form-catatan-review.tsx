"use client";

import { Button } from "@/components/ui/button";
import { PesanMuncul } from "@/components/ui/pesan-muncul";
import { Textarea } from "@/components/ui/textarea";
import type { HasilAksi } from "../server/aksi";
import { useFormAksi } from "./use-form-aksi";

/** Satu-satunya kolom inspeksi yang bisa diubah dari panel (H5). */
export function FormCatatanReview({
    aksi,
    id,
    nilai,
}: {
    aksi: (prev: unknown, fd: FormData) => Promise<HasilAksi>;
    id: string;
    nilai: string;
}) {
    const { state, onSubmit, menunggu } = useFormAksi(aksi);
    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={id} />
            <label htmlFor="catatanReview" className="text-sm font-medium">
                Catatan tinjauan
            </label>
            <Textarea id="catatanReview" name="catatanReview" defaultValue={nilai} rows={3} maxLength={2000} />
            <PesanMuncul
                role="alert"
                pesan={state && !state.ok ? (Object.values(state.galat ?? {}).flat()[0] ?? state.pesan) : undefined}
                celah="0.5rem"
                isiClassName="text-sm text-danger"
            />
            <Button type="submit" variant="outline" className="self-end" disabled={menunggu}>
                {menunggu ? "Menyimpan…" : "Simpan catatan"}
            </Button>
        </form>
    );
}
