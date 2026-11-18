"use client";

import { Camera } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ubahCapKoordinat } from "../actions/cap-foto";

/**
 * Sakelar admin: koordinat pada cap foto bukti (bawaan mati). Cap adalah lapisan tampilan di
 * aplikasi, layar tinjauan, dan PDF; berkas JPEG asli tidak pernah diubah.
 */
export function PengaturanCapFoto({ awal }: { awal: boolean }) {
    const [aktif, setAktif] = useState(awal);
    const [menunggu, mulai] = useTransition();
    return (
        <label className="mb-4 flex items-start gap-3 rounded-[var(--a-radius-kartu,16px)] border bg-card p-4 text-sm" data-testid="pengaturan-cap-foto">
            <Camera className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
                <b className="block">Tampilkan koordinat pada cap foto</b>
                <span className="text-muted-foreground">
                    Cap foto selalu memuat waktu, area, kode aset, inspektur, dan akurasi GPS. Koordinat bawaan disembunyikan karena denah
                    bersifat rahasia. Foto asli tidak diubah.
                </span>
            </span>
            <input
                type="checkbox"
                className="mt-1 size-5 accent-primary"
                checked={aktif}
                disabled={menunggu}
                onChange={(e) => {
                    const nilai = e.target.checked;
                    setAktif(nilai);
                    mulai(async () => {
                        const r = await ubahCapKoordinat({ aktif: nilai });
                        if (r.ok) toast.success(r.pesan ?? "Tersimpan.");
                        else {
                            setAktif(!nilai);
                            toast.error(r.pesan);
                        }
                    });
                }}
            />
        </label>
    );
}
