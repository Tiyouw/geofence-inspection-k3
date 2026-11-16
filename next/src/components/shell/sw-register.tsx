"use client";

import { useEffect } from "react";

/** Mendaftarkan service worker (public/sw.js) di produksi. Antrean luring dibangun sesi Inspektur. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
