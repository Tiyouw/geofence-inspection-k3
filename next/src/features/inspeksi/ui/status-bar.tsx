"use client";

import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { CloudOff, LogOut, Wifi } from "lucide-react";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { keluar } from "@/app/(publik)/masuk/actions";
import { bersihkanPerangkat, useInspektur } from "./konteks";
import { TautanLapangan } from "./tautan";

/** Indikator koneksi + jumlah antrean di bilah atas (SPEC §7.9). Ketuk untuk membuka Antrean. */
export function IndikatorKoneksi() {
  const { daring, data } = useInspektur();
  const antre = data.drafts.filter((d) => d.status !== "draf").length;
  return (
    <TautanLapangan href="/petugas/antrean" className="flex items-center gap-1.5 text-xs font-semibold" role="status" aria-live="polite">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
          daring ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
        )}
      >
        {daring ? <Wifi className="size-3.5" aria-hidden /> : <CloudOff className="size-3.5" aria-hidden />}
        {daring ? "Daring" : "Luring"}
      </span>
      {antre > 0 && (
        <span data-testid="lencana-antrean" className="rounded-full bg-info-soft px-2.5 py-1 text-info tabular-nums">
          {daring ? `${antre} dalam antrean` : `${antre} menunggu sinyal`}
        </span>
      )}
    </TautanLapangan>
  );
}

/** Keluar dengan peringatan bila antrean belum kosong, lalu kosongkan data perangkat. */
export function TombolKeluar({ className }: { className?: string }) {
  const { data, userId } = useInspektur();
  const [pending, start] = useTransition();
  const belum = data.drafts.filter((d) => d.status !== "draf").length;
  const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();
  return (
    <>
    <button
      type="button"
      disabled={pending}
      className={cn(
        "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-(--a-radius-kontrol,10px) border border-danger/30 bg-card text-base font-semibold text-danger hover:bg-danger-soft",
        className,
      )}
      onClick={async () => {
        if (
          belum > 0 &&
          !(await konfirmasi({
            judul: "Keluar dari akun?",
            jumlah: `${belum} inspeksi belum terkirim`,
            isi: "Keluar menghapus inspeksi itu dari ponsel ini. Tunggu sampai ada sinyal dan semuanya terkirim bila ingin menyimpannya.",
            tombol: "Keluar dan hapus",
            batal: "Tetap masuk",
            bahaya: true,
          }))
        )
          return;
        start(async () => {
          await bersihkanPerangkat(userId);
          await keluar();
        });
      }}
    >
      <LogOut className="size-5" aria-hidden />
      Keluar
    </button>
    {dialogKonfirmasi}
    </>
  );
}
