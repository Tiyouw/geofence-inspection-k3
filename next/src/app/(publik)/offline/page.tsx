import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Luring" };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted px-6 text-center">
      <div className="max-w-sm">
        <WifiOff className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold">Tidak ada sambungan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Halaman ini belum tersimpan di perangkat. Inspeksi yang sudah diisi tetap tersimpan dan dikirim saat sambungan kembali.
        </p>
      </div>
    </main>
  );
}
