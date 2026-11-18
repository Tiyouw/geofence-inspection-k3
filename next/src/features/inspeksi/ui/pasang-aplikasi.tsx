"use client";

import { Share, Smartphone, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { KARTU } from "./a";

/**
 * Ajakan memasang PWA (PWA-PLAN langkah "install prompt"). Android/Chrome: memakai
 * `beforeinstallprompt`. iOS Safari: tidak ada prompt, jadi tampilkan petunjuk Bagikan →
 * Tambah ke Layar Utama. Di iOS data situs yang tidak dipasang dapat dihapus setelah 7 hari
 * tanpa kunjungan, termasuk antrean yang belum terkirim, jadi ajakan ini penting.
 */
type PromptPasang = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let tertunda: PromptPasang | null = null;
const pendengar = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    tertunda = e as PromptPasang;
    pendengar.forEach((f) => f());
  });
  window.addEventListener("appinstalled", () => {
    tertunda = null;
    pendengar.forEach((f) => f());
  });
}

function langgan(f: () => void) {
  pendengar.add(f);
  return () => void pendengar.delete(f);
}

export function terpasang(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

function iosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

const KUNCI_TUTUP = "pal-k3:pasang-ditutup";

/** Keadaan pemasangan untuk Profil dan Beranda. */
export function useKeadaanPasang() {
  const prompt = useSyncExternalStore(langgan, () => tertunda, () => null);
  const [info, setInfo] = useState<{ sudah: boolean; ios: boolean }>({ sudah: false, ios: false });
  useEffect(() => {
    const t = setTimeout(() => setInfo({ sudah: terpasang(), ios: iosSafari() }), 0);
    return () => clearTimeout(t);
  }, []);
  return {
    ...info,
    bisaPrompt: !!prompt,
    pasang: async () => {
      if (!tertunda) return;
      await tertunda.prompt();
      await tertunda.userChoice.catch(() => null);
      tertunda = null;
      pendengar.forEach((f) => f());
    },
  };
}

/** Kartu ajakan di Beranda; bisa ditutup (diingat di perangkat ini). */
export function AjakanPasang() {
  const k = useKeadaanPasang();
  const [tutup, setTutup] = useState(true);
  useEffect(() => {
    let ditutup = false;
    try {
      ditutup = localStorage.getItem(KUNCI_TUTUP) === "1";
    } catch {}
    const t = setTimeout(() => setTutup(ditutup), 0);
    return () => clearTimeout(t);
  }, []);
  if (tutup || k.sudah || (!k.bisaPrompt && !k.ios)) return null;
  return (
    <div className={`${KARTU} flex items-start gap-3 p-4`} data-testid="ajakan-pasang">
      <Smartphone className="mt-0.5 size-5 shrink-0 text-info" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <p className="font-semibold">Pasang di layar utama</p>
        {k.ios ? (
          <p className="text-muted-foreground">
            Ketuk <Share className="inline size-4 align-text-bottom" aria-label="Bagikan" /> lalu <b>Tambah ke Layar Utama</b>. Inspeksi yang belum terkirim lebih aman tersimpan.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground">Buka lebih cepat, bekerja tanpa sinyal, dan antrean tetap aman di ponsel.</p>
            <Button size="sm" variant="outline" onClick={() => void k.pasang()}>
              Pasang aplikasi
            </Button>
          </>
        )}
      </div>
      <button
        type="button"
        aria-label="Tutup ajakan pasang"
        className="-m-1 grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        onClick={() => {
          try {
            localStorage.setItem(KUNCI_TUTUP, "1");
          } catch {}
          setTutup(true);
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
