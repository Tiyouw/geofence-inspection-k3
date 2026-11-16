"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { HasilAksi } from "../server/aksi";
import { useFormAksi } from "./use-form-aksi";

type Aksi = (prev: unknown, fd: FormData) => Promise<HasilAksi<unknown>>;

/**
 * Dialog berisi formulir yang memanggil satu Server Action. Galat validasi dari peladen
 * ditampilkan di atas kolom; berhasil menutup dialog dan menampilkan pesan.
 */
export function DialogAksi({
  judul,
  deskripsi,
  pemicu,
  varianPemicu = "outline",
  ukuranPemicu = "sm",
  aksi,
  tersembunyi,
  labelKirim = "Simpan",
  varianKirim = "default",
  children,
}: {
  judul: string;
  deskripsi?: string;
  pemicu: ReactNode;
  varianPemicu?: "outline" | "default" | "brand" | "ghost" | "destructive" | "secondary";
  ukuranPemicu?: "sm" | "default" | "xs";
  aksi: Aksi;
  tersembunyi?: Record<string, string | number>;
  labelKirim?: string;
  varianKirim?: "default" | "brand" | "destructive";
  children: ReactNode;
}) {
  const [buka, setBuka] = useState(false);
  const { state, onSubmit, menunggu } = useFormAksi(aksi);
  const idGalat = useId();

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.pesan ?? "Tersimpan.");
      setBuka(false);
    }
  }, [state]);

  const galat = state && !state.ok ? Object.values(state.galat ?? {}).flat() : [];

  return (
    <Dialog open={buka} onOpenChange={setBuka}>
      <DialogTrigger asChild>
        <Button variant={varianPemicu} size={ukuranPemicu}>
          {pemicu}
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-describedby={galat.length ? idGalat : undefined}>
          <DialogHeader>
            <DialogTitle>{judul}</DialogTitle>
            {deskripsi && <DialogDescription>{deskripsi}</DialogDescription>}
          </DialogHeader>
          {state && !state.ok && (
            <div id={idGalat} role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {galat.length ? galat.map((g) => <p key={g}>{g}</p>) : <p>{state.pesan}</p>}
            </div>
          )}
          {Object.entries(tersembunyi ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {children}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Batal
              </Button>
            </DialogClose>
            <Button type="submit" variant={varianKirim} disabled={menunggu}>
              {menunggu ? "Menyimpan…" : labelKirim}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
