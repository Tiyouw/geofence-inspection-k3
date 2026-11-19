"use client";

import { Camera } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ubahCapKoordinat } from "../actions/cap-foto";

/**
 * Sakelar admin: koordinat pada cap foto bukti dan detail tinjauan (bawaan mati). Cap adalah
 * lapisan tampilan; berkas JPEG asli tidak pernah diubah. Koordinat hanya tampil untuk Admin K3
 * (ADR-15): pemantau, inspektur, dan PDF tidak pernah menerimanya, apa pun nilai sakelar ini.
 */
export function PengaturanCapFoto({ awal }: { awal: boolean }) {
    const [aktif, setAktif] = useState(awal);
    const [menunggu, mulai] = useTransition();
    return (
        <label className="mb-4 flex items-start gap-3 rounded-[var(--a-radius-kartu,16px)] border bg-card p-4 text-sm" data-testid="pengaturan-cap-foto">
            <Camera className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
                <b className="block">Tampilkan koordinat pada cap foto dan detail tinjauan</b>
                <span className="text-muted-foreground">
                    Cap foto selalu memuat waktu, area, kode aset, inspektur, dan akurasi GPS. Koordinat (di cap foto dan baris
                    Koordinat pada detail tinjauan) hanya tampil untuk Admin K3, dan bawaan disembunyikan karena denah bersifat
                    rahasia. Pemantau, inspektur, dan PDF tidak pernah menampilkannya. Foto asli tidak diubah.
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
