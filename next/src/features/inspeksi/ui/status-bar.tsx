"use client";

import { CloudOff, LogOut, Wifi } from "lucide-react";
import { useTransition } from "react";
import { keluar } from "@/app/(publik)/masuk/actions";
import { bersihkanPerangkat, useInspektur } from "./konteks";

/** Indikator koneksi + jumlah antrean di bilah atas (SPEC §7.9). */
export function IndikatorKoneksi() {
  const { daring, data } = useInspektur();
  const antre = data.drafts.filter((d) => d.status !== "draf").length;
  return (
    <span className="flex items-center gap-2 text-xs text-white/85" role="status" aria-live="polite">
      {daring ? <Wifi className="size-4" aria-hidden /> : <CloudOff className="size-4 text-brand" aria-hidden />}
      <span className="hidden min-[380px]:inline">{daring ? "Daring" : "Luring"}</span>
      {antre > 0 && (
        <span data-testid="lencana-antrean" className="rounded-full bg-brand px-2 py-0.5 font-semibold text-brand-foreground">
          {daring ? `${antre} dalam antrean` : `${antre} menunggu sinyal`}
        </span>
      )}
    </span>
  );
}

/** Keluar dengan peringatan bila antrean belum kosong, lalu kosongkan data perangkat. */
export function TombolKeluar() {
  const { data, userId } = useInspektur();
  const [pending, start] = useTransition();
  const belum = data.drafts.filter((d) => d.status !== "draf").length;
  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
      onClick={() => {
        if (belum > 0 && !confirm(`Ada ${belum} inspeksi belum terkirim. Keluar akan menghapusnya dari perangkat ini.`)) return;
        start(async () => {
          await bersihkanPerangkat(userId);
          await keluar();
        });
      }}
    >
      <LogOut className="size-4" aria-hidden />
      <span className="sr-only min-[420px]:not-sr-only">Keluar</span>
    </button>
  );
}
