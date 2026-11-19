/// <reference lib="webworker" />
/**
 * Service worker PAL-K3, dibundel ke public/sw.js oleh scripts/build-sw.mjs (jangan sunting public/sw.js).
 *
 * - Halaman lapangan (/petugas, /pindai, /isi, /riwayat, /antrean, /profil): jaringan dulu
 *   dengan batas 4 detik, jatuh ke salinan terakhir saat luring/sinyal lemah. Query diabaikan
 *   sehingga /petugas/isi?id=… memakai cangkang yang sama.
 * - /i/{token} saat luring: dialihkan ke pemindai lokal /petugas/pindai?token=… (SPEC §7.3 butir 2).
 * - Navigation preload: permintaan halaman berangkat bersamaan dengan bangunnya service worker,
 *   jadi service worker tidak menambah jeda pada setiap navigasi penuh.
 * - Aset statis Next dan ikon: cache-first (nama berkas ber-hash). "hangatkan" juga menyimpan JS/CSS
 *   yang dirujuk halaman lapangan, karena navigasi klien tidak memuat halaman itu secara penuh.
 * - Background Sync "outbox": menguras antrean akun yang sedang masuk (kode sama dengan jendela).
 */
import { bukaDb, getPenggunaAktif } from "../client/db";
import { kuras, pengirimHttp } from "../client/outbox";
import { KANAL, denganKunci } from "../client/sinkron";

declare const self: ServiceWorkerGlobalScope;
declare const __SW_VERSION__: string;

const VERSION = __SW_VERSION__;
const PRECACHE = `pal-k3-precache-${VERSION}`;
const STATIC = "pal-k3-static";
const HALAMAN = "pal-k3-halaman";
const PRECACHE_URLS = ["/offline", "/icons/icon-192.png", "/icons/icon.svg"];
const HALAMAN_LAPANGAN = ["/petugas", "/petugas/pindai", "/petugas/isi", "/petugas/riwayat", "/petugas/antrean", "/petugas/profil"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PRECACHE).then((c) => c.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("pal-k3-precache-") && k !== PRECACHE).map((k) => caches.delete(k))))
      .then(() => self.registration.navigationPreload?.enable())
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});

function denganBatas(p: Promise<Response>, ms: number): Promise<Response> {
  return new Promise((ok, gagal) => {
    const t = setTimeout(() => gagal(new Error("timeout")), ms);
    p.then(
      (r) => (clearTimeout(t), ok(r)),
      (e) => (clearTimeout(t), gagal(e)),
    );
  });
}

/** Jawaban navigation preload bila ada, kalau tidak permintaan biasa. */
async function ambilNavigasi(event: FetchEvent): Promise<Response> {
  const pra = (await event.preloadResponse.catch(() => undefined)) as Response | undefined;
  return pra ?? fetch(event.request);
}

async function halamanLapangan(event: FetchEvent, path: string): Promise<Response> {
  const cache = await caches.open(HALAMAN);
  const jaringan = ambilNavigasi(event).then(async (res) => {
    // Simpan hanya halaman sungguhan, bukan pengalihan ke /masuk.
    if (res.ok && !res.redirected && new URL(res.url).pathname === path) await cache.put(path, res.clone());
    return res;
  });
  try {
    return await denganBatas(jaringan, 4000);
  } catch {
    const salinan = await cache.match(path);
    if (salinan) {
      jaringan.catch(() => {}); // biarkan selesai di latar untuk menyegarkan salinan
      return salinan;
    }
    try {
      return await jaringan;
    } catch {
      return (await caches.match("/offline")) ?? Response.error();
    }
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    const path = url.pathname.replace(/\/$/, "") || "/";
    if (HALAMAN_LAPANGAN.includes(path)) {
      event.respondWith(halamanLapangan(event, path));
      return;
    }
    const stiker = path.match(/^\/i\/([^/]+)$/);
    if (stiker) {
      event.respondWith(
        ambilNavigasi(event).catch(() => Response.redirect(`/petugas/pindai?token=${encodeURIComponent(stiker[1]!)}`, 302)),
      );
      return;
    }
    event.respondWith(ambilNavigasi(event).catch(async () => (await caches.match("/offline")) ?? Response.error()));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then(async (res) => {
            if (res.ok) await (await caches.open(STATIC)).put(req, res.clone());
            return res;
          }),
      ),
    );
  }
});

async function kurasLatar() {
  const userId = await getPenggunaAktif();
  if (userId === null) return;
  const hasil = await denganKunci(async () => kuras(await bukaDb(userId), pengirimHttp(fetch, self.location.origin)));
  const bc = new BroadcastChannel(KANAL);
  bc.postMessage({ jenis: "berubah", hasil });
  bc.close();
  // Galat jaringan: lempar supaya peramban menjadwalkan ulang sync.
  if (hasil && hasil.tersisa > 0 && hasil.gagal > 0 && !hasil.sesiHabis) throw new Error("antrean belum habis");
}

self.addEventListener("sync", (event: Event) => {
  const e = event as ExtendableEvent & { tag: string };
  if (e.tag === "outbox") e.waitUntil(kurasLatar());
});

/**
 * Simpan cangkang halaman lapangan beserta JS/CSS yang dirujuknya. Dulu aset ikut tersimpan karena
 * tiap ketukan menu memuat halaman penuh; kini menu memakai navigasi klien, jadi aset halaman yang
 * belum pernah dibuka penuh harus diambil di sini supaya halaman itu tetap hidup saat luring.
 */
async function hangatkan() {
  const [halaman, statis] = await Promise.all([caches.open(HALAMAN), caches.open(STATIC)]);
  const aset = new Set<string>();
  await Promise.all(
    HALAMAN_LAPANGAN.map(async (p) => {
      const res = await fetch(p, { credentials: "same-origin" }).catch(() => null);
      if (!res?.ok || res.redirected) return;
      const html = await res.clone().text();
      await halaman.put(p, res);
      for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+?\.(?:js|css)/g)) aset.add(m[0]);
    }),
  );
  await Promise.all(
    [...aset].map(async (u) => {
      if (await statis.match(u)) return;
      const res = await fetch(u).catch(() => null);
      if (res?.ok) await statis.put(u, res);
    }),
  );
}

self.addEventListener("message", (event) => {
  const data = event.data as { jenis?: string; urls?: string[] } | undefined;
  if (data?.jenis === "hangatkan") {
    // Simpan cangkang halaman lapangan saat daring supaya bisa dibuka luring.
    event.waitUntil(hangatkan());
  }
  if (data?.jenis === "bersihkan") {
    // Keluar: hapus salinan halaman berautentikasi (SPEC §7.10).
    event.waitUntil(caches.delete(HALAMAN));
  }
  if (data?.jenis === "kuras") event.waitUntil(kurasLatar().catch(() => {}));
});
