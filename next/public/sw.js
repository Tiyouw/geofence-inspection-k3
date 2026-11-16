/*
 * Service worker PAL-K3 (fondasi). Saat ini:
 *   - precache halaman /offline dan ikon;
 *   - navigasi: jaringan dulu, jatuh ke /offline saat luring;
 *   - aset statis Next (/_next/static): cache-first (nama berkas sudah ber-hash).
 * Antrean luring (Background Sync / IndexedDB) ditambahkan sesi Inspektur PWA di
 * berkas ini atau lewat importScripts("/sw-queue.js"). Naikkan VERSION saat mengubah.
 */
const VERSION = "v1";
const PRECACHE = `pal-k3-precache-${VERSION}`;
const STATIC = `pal-k3-static-${VERSION}`;
const PRECACHE_URLS = ["/offline", "/icons/icon-192.png", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PRECACHE).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PRECACHE, STATIC].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
