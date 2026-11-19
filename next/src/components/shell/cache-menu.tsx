"use client";

import type { PrefetchOptions } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { terdampak, type Peristiwa } from "@/lib/realtime/saluran";
import { useRealtime, type KonfigurasiRealtime } from "@/lib/realtime/use-realtime";

/** Selang prefetch ulang halaman menu selagi aplikasi terlihat. Lebih pendek dari staleTimes (next.config). */
const SELANG_PREFETCH_MS = 100_000;
/** Tanpa realtime: kembali ke aplikasi setelah tersembunyi/tak fokus selama ini, segarkan halaman. */
const SEGARKAN_SAAT_FOKUS_MS = 10_000;
/** Peristiwa beruntun (mis. setujui massal) digabung jadi satu penyegaran. */
const GABUNG_PERISTIWA_MS = 150;
const JARAK_SEGAR_MIN_MS = 1500;
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
 * - Realtime (ADR K-12): perubahan oleh pengguna lain datang sebagai peristiwa kecil. Bila
 *   menyangkut halaman menu ini, halaman yang tampil disegarkan (`router.refresh`) dan menu
 *   di-prefetch ulang, jadi isi baru tampil dalam 1-2 detik tanpa mengorbankan pindah menu instan.
 *   Tersambung lagi setelah putus: segarkan sekali (peristiwa di antaranya mungkin terlewat).
 * - Realtime tidak tersedia/putus: perilaku cadangan, yaitu prefetch berkala (data paling lama
 *   ~2 menit) dan segarkan saat kembali ke aplikasi.
 * - Dokumen yang disajikan dari cache service worker (mode aplikasi): disegarkan di latar.
 * - Mode aplikasi: service worker menyimpan dokumen halaman per pengguna (lihat sw/index.ts)
 *   supaya membuka aplikasi langsung menampilkan halaman terakhir. Pengguna lain mengosongkannya.
 */
export function CacheMenu({ hrefs, userId, realtime }: { hrefs: string[]; userId: number; realtime: KonfigurasiRealtime }) {
  const router = useRouter();
  const kunci = hrefs.join("|");
  const prefetchRef = useRef<() => void>(() => {});
  const segar = useRef({ pewaktu: undefined as ReturnType<typeof setTimeout> | undefined, terakhir: 0 });

  /** router.refresh lalu prefetch ulang menu; digabung dan dibatasi supaya peristiwa beruntun murah. */
  const segarkan = useCallback(() => {
    const s = segar.current;
    if (s.pewaktu) return;
    const tunda = Math.max(GABUNG_PERISTIWA_MS, s.terakhir + JARAK_SEGAR_MIN_MS - Date.now());
    s.pewaktu = setTimeout(() => {
      s.pewaktu = undefined;
      s.terakhir = Date.now();
      router.refresh();
      setTimeout(() => prefetchRef.current(), 1200);
    }, tunda);
  }, [router]);

  const status = useRealtime(
    realtime,
    (p: Peristiwa) => {
      const jalur = [location.pathname, ...kunci.split("|")];
      if (p.t === "pengguna" || jalur.some((j) => terdampak(p.t, j))) segarkan();
    },
    segarkan,
  );

  useEffect(() => {
    const daftar = kunci.split("|").filter(Boolean);
    let pewaktu: ReturnType<typeof setTimeout> | undefined;
    let tersembunyiSejak = 0;
    const prefetchSemua = () => {
      clearTimeout(pewaktu);
      if (document.visibilityState === "visible") daftar.forEach((h) => router.prefetch(h, PREFETCH_PENUH));
      pewaktu = setTimeout(prefetchSemua, SELANG_PREFETCH_MS);
    };
    prefetchRef.current = prefetchSemua;
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

    // Cadangan saat realtime tidak tersambung: segarkan ketika pengguna kembali ke aplikasi.
    // Saat tersambung tidak perlu; bila sambungan sempat ditutup karena tab tersembunyi lama,
    // useRealtime memanggil segarkan begitu tersambung lagi.
    const saatTerlihat = () => {
      if (document.visibilityState === "hidden" || !document.hasFocus()) {
        tersembunyiSejak ||= Date.now();
        return;
      }
      if (tersembunyiSejak && Date.now() - tersembunyiSejak > SEGARKAN_SAAT_FOKUS_MS && status.current !== "tersambung") segarkan();
      tersembunyiSejak = 0;
    };
    document.addEventListener("visibilitychange", saatTerlihat);
    window.addEventListener("focus", saatTerlihat);
    window.addEventListener("blur", saatTerlihat);
    return () => {
      clearTimeout(pewaktu);
      document.removeEventListener("visibilitychange", saatTerlihat);
      window.removeEventListener("focus", saatTerlihat);
      window.removeEventListener("blur", saatTerlihat);
    };
  }, [kunci, router, userId, segarkan, status]);
  return null;
}
