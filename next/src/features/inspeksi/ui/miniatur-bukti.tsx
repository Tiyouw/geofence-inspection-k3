"use client";

import { useState } from "react";
import { CapFoto } from "@/components/foto/cap-foto";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { DataCap } from "@/lib/foto/cap";

/**
 * Miniatur foto bukti untuk layar tinjauan; diketuk membuka foto besar dengan cap foto di atasnya.
 * Gambar lewat /api/foto/{id} yang memeriksa sesi dan peran.
 */
export function MiniaturBukti({ id, alt, cap, judul }: { id: string; alt: string; cap: DataCap; judul: string }) {
  const [buka, setBuka] = useState(false);
  return (
    <>
      <button
        type="button"
        data-lihat-foto
        onClick={() => setBuka(true)}
        className="relative block size-16 shrink-0 overflow-hidden rounded-md border bg-muted transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label={`${alt}, buka foto besar`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- foto privat lewat rute bersesi */}
        <img src={`/api/foto/${id}`} alt={alt} loading="lazy" className="size-full object-cover" />
      </button>
      <Dialog open={buka} onOpenChange={setBuka}>
        <DialogContent className="max-w-3xl sm:max-w-3xl">
          <DialogTitle>{judul}</DialogTitle>
          <div className="relative overflow-hidden rounded-lg bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto privat lewat rute bersesi */}
            <img src={`/api/foto/${id}`} alt={alt} className="max-h-[75vh] w-full object-contain" />
            <CapFoto data={cap} />
          </div>
          <a href={`/api/foto/${id}`} target="_blank" rel="noopener" className="text-sm underline underline-offset-4">
            Buka berkas asli (tanpa cap)
          </a>
        </DialogContent>
      </Dialog>
    </>
  );
}
