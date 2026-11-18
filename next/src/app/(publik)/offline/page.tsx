import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Luring" };
export const dynamic = "force-static";

/**
 * Cadangan service worker untuk halaman yang belum tersimpan di perangkat. Halaman lapangan
 * (Beranda, Pindai, Antrean, Riwayat, Profil) tetap jalan luring bila pernah dibuka saat daring.
 */
export default function OfflinePage() {
  return (
    <main data-peran="inspektur" className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div className="max-w-sm space-y-4">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-warning-soft text-warning">
          <WifiOff className="size-8" aria-hidden />
        </span>
        <h1 className="text-xl font-bold">Tidak ada sambungan</h1>
        <p className="text-sm text-muted-foreground">
          Halaman ini belum tersimpan di perangkat. Inspeksi yang sudah diisi tetap tersimpan dan dikirim otomatis saat sambungan kembali.
        </p>
        <div className="grid gap-2">
          {/* <a> biasa: halaman lapangan dilayani service worker saat luring */}
          <a href="/petugas" className="inline-flex h-12 items-center justify-center rounded-[var(--a-radius-kontrol,10px)] bg-brand font-bold text-brand-foreground">
            Ke beranda
          </a>
          <a href="/petugas/antrean" className="inline-flex h-12 items-center justify-center rounded-[var(--a-radius-kontrol,10px)] border bg-card font-semibold">
            Lihat antrean kirim
          </a>
        </div>
      </div>
    </main>
  );
}
