"use client";

import type { PrefetchOptions } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Selang prefetch ulang halaman menu selagi aplikasi terlihat. Lebih pendek dari staleTimes (next.config). */
const SELANG_PREFETCH_MS = 100_000;
/** Kembali ke aplikasi setelah tersembunyi selama ini: segarkan halaman yang tampil. */
const SEGARKAN_SETELAH_SEMBUNYI_MS = 60_000;
const PREFETCH_PENUH: PrefetchOptions = { kind: "full" as PrefetchOptions["kind"] };

/** Mode aplikasi terpasang (PWA), atau dipaksa untuk pengukuran lewat localStorage. */
function modeAplikasi(): boolean {
  try {
    if (localStorage.getItem("pal-k3-cache-dokumen") === "1") return true;
  } catch {}
  return window.matchMedia("(display-mode: standalone)").matches;
}

/**
 * Cache data halaman di klien supaya pindah menu terasa instan:
 *
 * - Data lengkap semua butir menu di-prefetch saat senggang setelah masuk, lalu diulang tiap
 *   SELANG_PREFETCH_MS selagi aplikasi terlihat. Next menyimpannya selama `staleTimes`
 *   (next.config), jadi ketukan menu langsung menampilkan isi tanpa menunggu peladen.
 * - Aksi server yang mengubah data memanggil revalidatePath: Next mengosongkan cache klien,
 *   prefetch berikutnya mengambil data baru.
 * - Kembali ke aplikasi setelah lama tersembunyi, atau dokumen yang disajikan dari cache service
 *   worker (mode aplikasi): halaman disegarkan di latar (`router.refresh`).
 * - Mode aplikasi: service worker menyimpan dokumen halaman per pengguna (lihat sw/index.ts)
 *   supaya membuka aplikasi langsung menampilkan halaman terakhir. Pengguna lain mengosongkannya.
 */
export function CacheMenu({ hrefs, userId }: { hrefs: string[]; userId: number }) {
  const router = useRouter();
  const kunci = hrefs.join("|");
  useEffect(() => {
    const daftar = kunci.split("|").filter(Boolean);
    let pewaktu: ReturnType<typeof setTimeout> | undefined;
    let tersembunyiSejak = 0;
    const prefetchSemua = () => {
      clearTimeout(pewaktu);
      if (document.visibilityState === "visible") daftar.forEach((h) => router.prefetch(h, PREFETCH_PENUH));
      pewaktu = setTimeout(prefetchSemua, SELANG_PREFETCH_MS);
    };
    const senggang = (f: () => void, ms: number) => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(f, { timeout: ms });
      else setTimeout(f, ms);
    };

    const sw = navigator.serviceWorker?.controller;
    if (sw) sw.postMessage(modeAplikasi() ? { jenis: "pemilik-dokumen", id: userId } : { jenis: "bersihkan-dokumen" });
    // Dokumen dari cache service worker: isinya mungkin usang, segarkan dulu baru prefetch.
    const dariCache = !!document.querySelector('meta[name="pal-k3-dari-cache"]');
    if (dariCache) router.refresh();
    senggang(prefetchSemua, dariCache ? 4000 : 2500);

    const saatTerlihat = () => {
      if (document.visibilityState === "hidden") {
        tersembunyiSejak = Date.now();
        return;
      }
      if (tersembunyiSejak && Date.now() - tersembunyiSejak > SEGARKAN_SETELAH_SEMBUNYI_MS) {
        router.refresh();
        setTimeout(prefetchSemua, 2000);
      }
      tersembunyiSejak = 0;
    };
    document.addEventListener("visibilitychange", saatTerlihat);
    return () => {
      clearTimeout(pewaktu);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, [kunci, router, userId]);
  return null;
}
