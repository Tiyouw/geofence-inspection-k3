"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

/**
 * Tautan antarhalaman lapangan. Daring: navigasi klien Next (kerangka tetap terpasang, data lokal
 * tidak dibaca ulang, rute sudah di-prefetch). Luring: navigasi penuh, supaya service worker
 * menyajikan salinan halaman yang tersimpan; navigasi klien Next 16 justru menunggu sinyal kembali.
 */
export function TautanLapangan({ href, onClick, ...props }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const klik = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (!navigator.onLine) {
      e.preventDefault();
      window.location.assign(href);
    }
  };
  return <Link href={href} onClick={klik} {...props} />;
}

/** Versi terprogram TautanLapangan: navigasi klien saat daring, navigasi penuh saat luring. */
export function pindahLapangan(router: { push: (href: string) => void }, href: string) {
  if (navigator.onLine) router.push(href);
  else window.location.assign(href);
}
