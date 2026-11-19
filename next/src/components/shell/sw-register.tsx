"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Mendaftarkan service worker (public/sw.js) di produksi. Di halaman /masuk (setelah keluar,
 * sesi habis, atau sebelum pengguna lain masuk) cache dokumen admin/pemantau dikosongkan supaya
 * data satu pengguna tidak pernah tampil untuk pengguna lain. Antrean inspektur tidak disentuh.
 */
export function ServiceWorkerRegister() {
  const pathname = usePathname();
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  useEffect(() => {
    if (pathname.startsWith("/masuk")) navigator.serviceWorker?.controller?.postMessage({ jenis: "bersihkan-dokumen" });
  }, [pathname]);
  return null;
}
