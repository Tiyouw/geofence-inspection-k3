"use client";

import { useEffect } from "react";

/**
 * Memasang data-peran juga pada <html>, supaya dialog, menu pilihan, dan toast yang dirender di luar
 * kerangka (portal ke <body>) ikut memakai palet peran (tema.css).
 */
export function PeranDokumen({ peran }: { peran: string }) {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.peran = peran;
    return () => {
      if (html.dataset.peran === peran) delete html.dataset.peran;
    };
  }, [peran]);
  return null;
}
