import { expect, type Page } from "@playwright/test";

/** Kamera palsu Chromium (pola uji bawaan) dengan izin otomatis: uji kamera terpandu tanpa perangkat. */
export const KAMERA_PALSU = {
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
  permissions: ["camera", "geolocation"],
};

/** Judul langkah APAR (PRD Aturan bukti 3), urut. */
export const LANGKAH_APAR = [
  "Tabung utuh dan label",
  "Manometer",
  "Segel & pin",
  "Selang dan mulut pancar",
  "Posisi pasang dan kartu kontrol",
];

/** Jalankan kamera terpandu: satu jepretan per langkah, lalu Simpan semua. */
export async function fotoSemuaLangkah(page: Page) {
  await page.getByTestId("buka-kamera").click();
  const kamera = page.getByTestId("kamera-terpandu");
  for (const [i, judul] of LANGKAH_APAR.entries()) {
    await expect(kamera.getByTestId("judul-langkah")).toHaveText(`Foto sekarang: ${judul}`);
    await kamera.getByRole("button", { name: "Jepret" }).click();
    await expect(kamera.getByTestId("penghitung-jepretan")).toContainText("1/5 foto");
    await kamera.getByRole("button", { name: i === LANGKAH_APAR.length - 1 ? "Tinjau" : "Lanjut" }).click();
  }
  await kamera.getByRole("button", { name: /Simpan semua \(5 foto\)/ }).click();
  await expect(kamera).toHaveCount(0);
  await expect(page.getByTestId("progres-foto")).toHaveText("5/5 langkah");
}
