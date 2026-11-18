import { chromium, devices, expect, test, type Browser, type Page } from "@playwright/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import jsQR from "jsqr";
import { masuk } from "../helpers";
import { aset, tutup } from "../db-uji";

/**
 * Bug demo 17 Nov: kamera menyala tetapi QR tidak pernah terbaca, kamera depan terbuka lebih dulu,
 * dan kode cadangan yang diketik dari stiker ditolak. Uji ini memakai kamera palsu Chromium yang
 * menayangkan stiker ASLI dari lembar stiker aplikasi (/stiker), lalu memastikan formulir terbuka.
 *
 * Penyebab uji "layar lain" kadang gagal di CI (18 Nov): kotak QR ditangkap pada skala 2 (88 px untuk
 * puluhan modul) lalu diperbesar maksimal 1,6x dengan penghalusan, sehingga tiap modul hanya ~4 px buram
 * di atas latar gelap. jsQR membaca bingkai seperti itu hanya kadang-kadang (bergantung pembulatan
 * penskalaan video), dan uji sering habis waktu. Sekarang: tangkapan skala 4, layar digambar tajam tanpa
 * penghalusan pada ukuran yang wajar, dan setiap bingkai DIPERIKSA dengan jsQR (pustaka yang sama dengan
 * aplikasi) sebelum dipakai, jadi bingkai yang tidak terbaca langsung gagal di persiapan, bukan acak.
 */
test.afterAll(tutup);

const W = 640;
const H = 480;

/**
 * Gambar elemen stiker (PNG dari aplikasi) → bingkai Y4M 4:2:0 di atas latar abu `bg`, selebar `lebar`
 * piksel. `tajam`: tanpa penghalusan (piksel layar), selain itu dihaluskan (foto label cetak).
 */
async function keY4m(page: Page, png: Buffer, bg: number, lebar: number, berkas: string, tajam = false) {
  const y = await page.evaluate(
    async ({ b64, W, H, bg, lebar, tajam }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const s = lebar / img.width;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d")!;
      ctx.imageSmoothingEnabled = !tajam;
      ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
      const d = ctx.getImageData(0, 0, W, H).data;
      const out = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) out[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
      let bin = "";
      for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000));
      return btoa(bin);
    },
    { b64: png.toString("base64"), W, H, bg, lebar, tajam },
  );
  // Bingkai harus terbaca oleh dekoder aplikasi (jsQR, dua arah warna) sebelum dipakai kamera palsu.
  const luma = Buffer.from(y, "base64");
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = luma[i]!;
    rgba[i * 4 + 3] = 255;
  }
  expect(jsQR(rgba, W, H, { inversionAttempts: "attemptBoth" })?.data, `bingkai ${berkas} terbaca jsQR`).toMatch(/PAL-K3-[0-9a-f]{32}$/);
  const frame = Buffer.concat([
    Buffer.from("FRAME\n"),
    Buffer.from(y, "base64"),
    Buffer.alloc((W / 2) * (H / 2) * 2, 128),
  ]);
  writeFileSync(berkas, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F15:1 Ip A1:1 C420jpeg\n`), ...Array(20).fill(frame)]));
}

async function pindaiDenganKamera(browserAsli: Browser, berkas: string, opsi: { detektorDiam?: boolean } = {}) {
  void browserAsli;
  const b = await chromium.launch({
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${berkas}`],
  });
  try {
    const ctx = await b.newContext({
      ...devices["Pixel 7"],
      baseURL: test.info().project.use.baseURL,
      permissions: ["camera"],
    });
    // Catat batasan getUserMedia (sessionStorage: bertahan saat pindah ke formulir).
    await ctx.addInitScript(() => {
      const asli = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
      if (!asli) return;
      navigator.mediaDevices.getUserMedia = (c) => {
        const a = JSON.parse(sessionStorage.getItem("gum") || "[]");
        a.push(c);
        sessionStorage.setItem("gum", JSON.stringify(a));
        return asli(c);
      };
    });
    if (opsi.detektorDiam) {
      // Android Chrome: BarcodeDetector ada, tetapi modul pemindainya (Play Services) belum siap,
      // sehingga detect() selalu mengembalikan [] tanpa galat.
      await ctx.addInitScript(() => {
        class DetektorDiam {
          static async getSupportedFormats() {
            return ["qr_code"];
          }
          async detect() {
            return [];
          }
        }
        (globalThis as unknown as { BarcodeDetector: unknown }).BarcodeDetector = DetektorDiam;
      });
    }
    const page = await ctx.newPage();
    await masuk(page, "inspektur");
    await page.goto("/petugas/pindai");
    await page.getByRole("button", { name: "Nyalakan kamera" }).click();
    // Bingkai sudah terbukti terbaca; pembacaan biasanya < 2 dtk. Batas ini masih di dalam batas uji.
    await expect(page).toHaveURL(/\/petugas\/isi\?id=/, { timeout: 20_000 });
    const gum = (await page.evaluate(() => JSON.parse(sessionStorage.getItem("gum") || "[]"))) as {
      video?: { facingMode?: { exact?: string } };
    }[];
    expect(gum[0]?.video?.facingMode?.exact, "kamera belakang diminta lebih dulu").toBe("environment");
  } finally {
    await b.close();
  }
}

test.describe("pemindai QR", () => {
  // Tiap uji meluncurkan peramban sendiri dan masuk; 60 dtk memberi ruang untuk itu plus 20 dtk pembacaan.
  test.describe.configure({ mode: "serial", timeout: 60_000 });
  let dir: string;

  test.beforeAll(async ({ browser }) => {
    dir = mkdtempSync(join(tmpdir(), "pal-k3-qr-"));
    // Skala 4: kotak QR 43 px CSS menjadi ~176 px, cukup tajam untuk setiap modul.
    const ctx = await browser.newContext({ deviceScaleFactor: 4, baseURL: test.info().project.use.baseURL });
    const page = await ctx.newPage();
    await masuk(page, "admin");
    await page.goto("/stiker?kode=01D&tata=2x5");
    const label = page.locator('.stiker-label[data-kode="01D"]');
    await expect(label).toHaveCount(1);
    const stiker = await label.screenshot();
    const qr = await label.locator(".stiker-qr").screenshot();
    const kosong = await ctx.newPage();
    // Stiker tercetak di label putih, difoto dari dekat.
    await keY4m(kosong, stiker, 235, 560, join(dir, "stiker.y4m"));
    // QR yang ditampilkan di layar lain: hanya kotak QR, piksel layar tajam di atas latar gelap.
    await keY4m(kosong, qr, 30, 300, join(dir, "layar.y4m"), true);
    await ctx.close();
  });

  test("stiker cetak dari lembar stiker terbaca kamera belakang", async ({ browser }) => {
    await pindaiDenganKamera(browser, join(dir, "stiker.y4m"));
  });

  test("QR yang tampil di layar lain terbaca", async ({ browser }) => {
    await pindaiDenganKamera(browser, join(dir, "layar.y4m"));
  });

  test("tetap terbaca saat BarcodeDetector ada tetapi tidak pernah menemukan apa pun", async ({ browser }) => {
    await pindaiDenganKamera(browser, join(dir, "stiker.y4m"), { detektorDiam: true });
  });

  test("kode cadangan tercetak diterima dalam berbagai ketikan; nomor aset diberi petunjuk", async ({ page }) => {
    const a = await aset("01D");
    const hex = a.token.slice(7);
    await masuk(page, "inspektur");
    const ketikan = [
      "PAL-K3-" + (hex.match(/.{4}/g) ?? []).join(" "), // persis seperti tercetak
      a.token.toUpperCase(),
      ` ${a.token.slice(0, 20)}\n${a.token.slice(20)} `,
      hex,
    ];
    for (const teks of ketikan) {
      await page.goto("/petugas/pindai");
      await page.getByLabel(/Kode cadangan/).fill(teks);
      await page.getByRole("button", { name: "Buka" }).click();
      await expect(page, `ketikan: ${JSON.stringify(teks.slice(0, 12))}…`).toHaveURL(/\/petugas\/isi\?id=/);
    }
    await page.goto("/petugas/pindai");
    await page.getByLabel(/Kode cadangan/).fill("01D");
    await page.getByRole("button", { name: "Buka" }).click();
    await expect(page.getByTestId("pesan-pindai")).toContainText("Itu nomor aset");
  });
});
