"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Prefetch semua tujuan menu saat peramban senggang. `<Link>` hanya mem-prefetch tautan yang terlihat,
 * padahal di ponsel bilah samping tersembunyi dan menu "Lainnya" tertutup, jadi rute itu baru diambil
 * saat diketuk. Rute dinamis hanya di-prefetch sampai `loading.tsx` terdekat (kerangka muat), jadi
 * biayanya kecil dan ketukan langsung menampilkan kerangka.
 */
export function PrefetchMenu({ hrefs }: { hrefs: string[] }) {
  const router = useRouter();
  const kunci = hrefs.join("|");
  useEffect(() => {
    const daftar = kunci.split("|").filter(Boolean);
    const jalankan = () => daftar.forEach((h) => router.prefetch(h));
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(jalankan, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(jalankan, 1500);
    return () => clearTimeout(t);
  }, [kunci, router]);
  return null;
}
