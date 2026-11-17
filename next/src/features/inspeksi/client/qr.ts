/**
 * Kamera dan pembaca QR untuk pemindai lapangan.
 *
 * Akar masalah lama (demo 17 Nov, Android Chrome dan iOS Safari):
 * - `facingMode: { ideal: "environment" }` hanya saran; sebagian ponsel tetap membuka kamera depan.
 * - BarcodeDetector dipakai tanpa memeriksa format yang didukung; bila tidak mendukung QR atau
 *   melempar galat, hasilnya `[]` selamanya dan jsQR tidak pernah dicoba.
 * - jsQR membaca bingkai resolusi penuh (sampai 1920x1080 di iPhone) dengan `dontInvert`:
 *   lambat sekali, dan QR pada layar gelap/terbalik tidak terbaca.
 */

type DetektorQR = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
type KelasDetektor = (new (o: { formats: string[] }) => DetektorQR) & { getSupportedFormats?: () => Promise<string[]> };

/** Sisi terpanjang bingkai yang diberikan ke jsQR. Cukup untuk QR selebar seperempat bingkai. */
export const SISI_MAKS_JSQR = 720;

const POLA_BELAKANG = /back|rear|environment|belakang|trás|arrière|後|后/i;
const POLA_DEPAN = /front|user|depan|facetime|selfie/i;

export type Hadap = "environment" | "user";

function videoDasar(): MediaTrackConstraints {
  return { width: { ideal: 1280 }, height: { ideal: 720 } };
}

/** Kamera belakang lebih dulu: `exact`, lalu cocokkan label perangkat, lalu `ideal`, lalu apa saja. */
export async function bukaKamera(hadap: Hadap, md: MediaDevices = navigator.mediaDevices): Promise<MediaStream> {
  const coba = async (video: MediaTrackConstraints | true) => md.getUserMedia({ video, audio: false });
  let s: MediaStream | null = null;
  try {
    s = await coba({ ...videoDasar(), facingMode: { exact: hadap } });
  } catch {
    try {
      s = await coba({ ...videoDasar(), facingMode: { ideal: hadap } });
    } catch {
      s = await coba(true);
    }
  }
  // Label perangkat baru terbaca setelah izin diberikan. Bila yang terbuka bukan kamera yang
  // diminta, pindah ke perangkat yang labelnya cocok.
  const track = s.getVideoTracks()[0];
  const facing = track?.getSettings?.().facingMode;
  const label = track?.label ?? "";
  const salah = hadap === "environment" ? facing === "user" || (!facing && POLA_DEPAN.test(label)) : facing === "environment";
  if (salah) {
    const daftar = (await md.enumerateDevices()).filter((d) => d.kind === "videoinput");
    const pola = hadap === "environment" ? POLA_BELAKANG : POLA_DEPAN;
    const cocok = daftar.filter((d) => pola.test(d.label));
    // Ponsel dengan beberapa kamera belakang: yang terakhir biasanya kamera utama (bukan ultra-wide).
    const pilih = cocok[cocok.length - 1];
    if (pilih && pilih.deviceId !== track.getSettings?.().deviceId) {
      s.getTracks().forEach((t) => t.stop());
      s = await coba({ ...videoDasar(), deviceId: { exact: pilih.deviceId } });
    }
  }
  // Fokus otomatis terus-menerus bila didukung (Android); diabaikan bila tidak.
  const t = s.getVideoTracks()[0];
  const kemampuan = t?.getCapabilities?.() as (MediaTrackCapabilities & { focusMode?: string[] }) | undefined;
  if (kemampuan?.focusMode?.includes("continuous")) {
    await t.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
  }
  return s;
}

export type PembacaQR = { baca(video: HTMLVideoElement, kanvas: HTMLCanvasElement): Promise<string | null>; mesin(): string };

/**
 * BarcodeDetector bila benar-benar mendukung QR; jsQR sebagai cadangan, dan juga dijalankan
 * setiap bingkai ketiga walau detektor ada (detektor sebagian ponsel diam tanpa galat).
 */
export async function buatPembacaQR(): Promise<PembacaQR> {
  let detektor: DetektorQR | null = null;
  const BD = (globalThis as unknown as { BarcodeDetector?: KelasDetektor }).BarcodeDetector;
  if (BD) {
    try {
      const format = BD.getSupportedFormats ? await BD.getSupportedFormats() : ["qr_code"];
      if (format.includes("qr_code")) detektor = new BD({ formats: ["qr_code"] });
    } catch {
      detektor = null;
    }
  }
  const jsQR = (await import("jsqr")).default;
  let bingkai = 0;
  let galatDetektor = 0;

  return {
    mesin: () => (detektor ? "BarcodeDetector+jsQR" : "jsQR"),
    async baca(video, kanvas) {
      if (video.readyState < 2 || !video.videoWidth) return null;
      bingkai++;
      if (detektor) {
        try {
          const kode = await detektor.detect(video);
          if (kode[0]?.rawValue) return kode[0].rawValue;
        } catch {
          if (++galatDetektor >= 5) detektor = null;
        }
        if (bingkai % 3 !== 0) return null;
      }
      const skala = Math.min(1, SISI_MAKS_JSQR / Math.max(video.videoWidth, video.videoHeight));
      const w = Math.round(video.videoWidth * skala);
      const h = Math.round(video.videoHeight * skala);
      kanvas.width = w;
      kanvas.height = h;
      const ctx = kanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      // attemptBoth: QR di layar dengan tema gelap atau stiker terbalik warna tetap terbaca.
      return jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" })?.data ?? null;
    },
  };
}
