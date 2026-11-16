"use client";

import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

type Hasil = { ok: boolean; pesan?: string };

/**
 * Memanggil Server Action dari formulir tanpa reset otomatis React 19, jadi masukan dipertahankan
 * saat peladen menolak isian (G1/M3). Pesan berhasil dimunculkan langsung dari hasil aksi, karena
 * komponen pemanggil bisa hilang setelah halaman disegarkan (mis. tombol "Tinjau posisi").
 */
export function useFormAksi<R extends Hasil>(
    aksi: (prev: unknown, fd: FormData) => Promise<R>,
    opsi: { setelahBerhasil?: (r: R) => void; pesanBawaan?: string } = {},
) {
    const [state, setState] = useState<R | null>(null);
    const [menunggu, mulai] = useTransition();
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        mulai(async () => {
            const r = await aksi(null, fd);
            setState(r);
            if (r.ok) {
                toast.success(r.pesan ?? opsi.pesanBawaan ?? "Tersimpan.");
                opsi.setelahBerhasil?.(r);
            }
        });
    };
    return { state, onSubmit, menunggu };
}
