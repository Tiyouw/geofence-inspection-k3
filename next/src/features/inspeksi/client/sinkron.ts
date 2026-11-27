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

/** Jalankan fn dengan kunci bersama; bila kunci sedang dipakai, tunggu giliran. */
export async function denganKunci<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks) return fn();
  return locks.request(KUNCI, fn);
}

let giliranBerikut: Promise<HasilKuras> | null = null;

/**
 * Kuras antrean akun ini, lalu umumkan ke semua tab dan SW. Panggilan saat pengurasan
 * sedang berjalan digabung menjadi SATU putaran sesudahnya (tidak hilang, tidak menumpuk),
 * supaya operasi yang baru masuk antrean langsung ikut terkirim.
 */
export function kurasSekarang(userId: number): Promise<HasilKuras> {
  if (giliranBerikut) return giliranBerikut;
  const p = denganKunci(async () => {
    giliranBerikut = null; // mulai berjalan: panggilan berikutnya menjadwalkan putaran baru
    return kuras(await bukaDb(userId), pengirimHttp());
  }).then((hasil) => {
    umumkan({ jenis: "berubah", hasil });
    return hasil;
  });
  giliranBerikut = p;
  return p;
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
