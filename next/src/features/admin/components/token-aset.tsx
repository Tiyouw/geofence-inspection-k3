"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { gantiTokenAset, lihatTokenAset } from "../actions/aset";

/** Token hanya diambil saat diminta (dicatat di audit), tidak pernah ada di HTML awal. */
export function LihatToken({ id }: { id: number }) {
  const [token, setToken] = useState<string | null>(null);
  const [menunggu, mulai] = useTransition();
  if (token) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-muted px-2 py-1 font-mono text-xs break-all">{token}</code>
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => navigator.clipboard.writeText(token).then(() => toast.success("Token disalin."))}
        >
          Salin
        </Button>
      </div>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={menunggu}
      onClick={() =>
        mulai(async () => {
          const r = await lihatTokenAset(id);
          if (r.ok && r.data) setToken(r.data.token);
          else if (!r.ok) toast.error(r.pesan);
        })
      }
    >
      Tampilkan token
    </Button>
  );
}

/** "Ganti token" dengan konfirmasi berbahaya (C7). */
export function GantiToken({ id, kode }: { id: number; kode: string }) {
  const [menunggu, mulai] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" size="sm" variant="destructive" disabled={menunggu}>
          Ganti token
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ganti token stiker {kode}?</AlertDialogTitle>
          <AlertDialogDescription>
            Stiker yang tertempel sekarang langsung tidak berlaku. Inspektur tidak bisa memeriksa aset ini sampai stiker baru
            dicetak dan ditempel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() =>
              mulai(async () => {
                const r = await gantiTokenAset(id);
                if (r.ok) toast.success(r.pesan ?? "Token diganti.");
                else toast.error(r.pesan);
              })
            }
          >
            Ya, ganti token
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
