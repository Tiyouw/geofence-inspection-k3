"use client";

/**
 * Dialog konfirmasi: satu-satunya pengganti window.confirm/alert/prompt di aplikasi.
 *
 *   const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();
 *   if (!(await konfirmasi({ judul: "Hapus foto?", isi: "…", tombol: "Hapus", bahaya: true }))) return;
 *   …
 *   return <>{…}{dialogKonfirmasi}</>;
 *
 * AlertDialog Radix: fokus terkunci di dialog, Esc dan "Batal" menolak, fokus kembali ke pemicu.
 */
import * as React from "react";
import { cn } from "cn";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type OpsiKonfirmasi = {
  judul: string;
  /** Penjelasan dalam bahasa sehari-hari: apa yang terjadi bila dilanjutkan. */
  isi?: React.ReactNode;
  /** Jumlah yang terdampak, ditampilkan menonjol (mis. "12 foto"). */
  jumlah?: string;
  /** Label tombol lanjut; bawaan "Lanjutkan". */
  tombol?: string;
  /** Label tombol batal; bawaan "Batal". */
  batal?: string;
  /** Untuk menghapus/membuang: tombol merah. */
  bahaya?: boolean;
};

type Tertunda = OpsiKonfirmasi & { selesai: (ya: boolean) => void };

export function useKonfirmasi(): [(opsi: OpsiKonfirmasi) => Promise<boolean>, React.ReactNode] {
  const [tertunda, setTertunda] = React.useState<Tertunda | null>(null);
  const [buka, setBuka] = React.useState(false);

  const konfirmasi = React.useCallback(
    (opsi: OpsiKonfirmasi) =>
      new Promise<boolean>((selesai) => {
        setTertunda({ ...opsi, selesai });
        setBuka(true);
      }),
    [],
  );

  const tutup = (ya: boolean) => {
    tertunda?.selesai(ya);
    setBuka(false);
  };

  const dialog = (
    <DialogKonfirmasi
      buka={buka}
      opsi={tertunda}
      onBatal={() => tutup(false)}
      onLanjut={() => tutup(true)}
    />
  );
  return [konfirmasi, dialog];
}

export function DialogKonfirmasi({
  buka,
  opsi,
  onBatal,
  onLanjut,
}: {
  buka: boolean;
  opsi: OpsiKonfirmasi | null;
  onBatal: () => void;
  onLanjut: () => void;
}) {
  return (
    <AlertDialog open={buka} onOpenChange={(b) => !b && onBatal()}>
      {/* z di atas kamera terpandu (z-50) dan lembar menu. */}
      <AlertDialogContent className="z-[70] data-[size=default]:max-w-sm" data-testid="dialog-konfirmasi">
        <AlertDialogHeader>
          <AlertDialogTitle>{opsi?.judul}</AlertDialogTitle>
          {(opsi?.isi || opsi?.jumlah) && (
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {opsi?.jumlah && (
                  <p className={cn("text-base font-semibold text-foreground", opsi.bahaya && "text-danger")}>{opsi.jumlah}</p>
                )}
                {opsi?.isi && <div>{opsi.isi}</div>}
              </div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onBatal}>{opsi?.batal ?? "Batal"}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onLanjut}
            variant={opsi?.bahaya ? "destructive" : "default"}
            className={cn(opsi?.bahaya && "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/30")}
          >
            {opsi?.tombol ?? "Lanjutkan"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
