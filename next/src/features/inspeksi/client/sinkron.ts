/**
 * Pemicu pengurasan antrean (SPEC §7.5): event online, kembali terlihat, setelah setiap
 * penulisan, pengatur waktu, dan Background Sync (Android/Chromium). iOS tidak punya
 * Background Sync: kuras saat aplikasi dibuka/kembali ke depan, plus tombol "Kirim sekarang".
 * Jendela dan service worker berbagi kunci "pal-k3-outbox" (Web Locks) agar tidak bersamaan.
 */
import { bukaDb } from "./db";
import { kuras, percobaanBerikutnya, pengirimHttp, type HasilKuras } from "./outbox";

export const KANAL = "pal-k3-antrean";
const KUNCI = "pal-k3-outbox";

export async function denganKunci<T>(fn: () => Promise<T>): Promise<T | null> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks) return fn();
  return locks.request(KUNCI, { ifAvailable: true }, async (lock) => (lock ? fn() : null));
}

/** Kuras antrean akun ini sekali, lalu umumkan ke semua tab dan SW. */
export async function kurasSekarang(userId: number): Promise<HasilKuras | null> {
  const hasil = await denganKunci(async () => kuras(await bukaDb(userId), pengirimHttp()));
  umumkan({ jenis: "berubah", hasil });
  return hasil;
}

export type PesanKanal = { jenis: "berubah"; hasil?: HasilKuras | null };

export function umumkan(p: PesanKanal) {
  if (typeof BroadcastChannel === "undefined") return;
  const bc = new BroadcastChannel(KANAL);
  bc.postMessage(p);
  bc.close();
}

/** Daftarkan Background Sync bila ada (Chromium/Android). */
export async function daftarSyncLatar() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sync = (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync;
    await sync?.register("outbox");
  } catch {
    // tidak didukung (iOS) atau ditolak: pemicu lain tetap jalan
  }
}

/** Pasang pemicu di jendela. Mengembalikan fungsi pelepas. */
export function pasangPemicu(userId: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let berhenti = false;

  const jalan = async () => {
    if (berhenti) return;
    clearTimeout(timer);
    if (navigator.onLine) await kurasSekarang(userId);
    if (berhenti) return;
    const db = await bukaDb(userId);
    const berikut = await percobaanBerikutnya(db);
    // Tetap periksa tiap 30 detik; lebih cepat bila ada percobaan terjadwal.
    const jeda = berikut === null ? 30_000 : Math.min(30_000, Math.max(1_000, berikut - Date.now()));
    timer = setTimeout(jalan, jeda);
  };

  const saatTerlihat = () => document.visibilityState === "visible" && void jalan();
  window.addEventListener("online", jalan);
  document.addEventListener("visibilitychange", saatTerlihat);
  void daftarSyncLatar();
  void jalan();

  return () => {
    berhenti = true;
    clearTimeout(timer);
    window.removeEventListener("online", jalan);
    document.removeEventListener("visibilitychange", saatTerlihat);
  };
}
