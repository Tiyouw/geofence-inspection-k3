"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { keluar } from "@/app/(publik)/masuk/actions";
import { useKonfirmasi } from "@/components/ui/konfirmasi";
import { cn } from "@/lib/utils";

/**
 * Keluar dengan dialog konfirmasi (admin dan pemantau). `ringkas`: hanya ikon; label "Keluar"
 * tetap terbaca pembaca layar. Inspektur memakai TombolKeluar (membersihkan data perangkat).
 */
export function SignOutButton({ className, ringkas = false }: { className?: string; ringkas?: boolean }) {
  const [konfirmasi, dialog] = useKonfirmasi();
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        title={ringkas ? "Keluar" : undefined}
        className={cn("inline-flex items-center gap-2 text-sm", className)}
        onClick={async () => {
          const ya = await konfirmasi({
            judul: "Keluar dari akun?",
            isi: "Anda perlu masuk lagi dengan NIP dan kata sandi untuk membuka panel ini.",
            tombol: "Keluar",
            batal: "Tetap masuk",
          });
          if (ya) start(() => keluar());
        }}
      >
        <LogOut className="size-4" aria-hidden />
        <span className={cn(ringkas && "sr-only")}>Keluar</span>
      </button>
      {dialog}
    </>
  );
}
