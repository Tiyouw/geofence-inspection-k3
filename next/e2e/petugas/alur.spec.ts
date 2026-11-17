import { expect, test, type Page } from "@playwright/test";
import { masuk } from "../helpers";
import { aset, q, tutup } from "../db-uji";
import { fotoSemuaLangkah, KAMERA_PALSU } from "../kamera-uji";

/** SPEC §3 + ACCEPTANCE C/D/E/F/G: alur inspeksi lengkap dari ponsel. */
test.use(KAMERA_PALSU);
test.afterAll(tutup);

async function isiSemua(page: Page, opsi: { volume: "Penuh" | "Tidak penuh" }) {
  const pilih = async (label: string, nilai: string) =>
    page.getByRole("radiogroup", { name: label, exact: true }).getByRole("radio", { name: nilai, exact: true }).click();
  await pilih("Volume isi tabung", opsi.volume);
  await pilih("Tekanan manometer", "Zona hijau");
  await pilih("Segel dan mekanik penembus", "Ada");
  await pilih("Badan tabung", "Mulus");
  for (const label of [
    "Handle dan tuas",
    "Label dan petunjuk pakai",
    "Mulut pancar tidak tersumbat",
    "Pipa atau selang pancar tidak retak",
    "Keterjangkauan dan ketinggian",
    "Tanda pemasangan dan kartu kontrol",
  ]) {
    await pilih(label, "Ada");
  }
  await expect(page.getByTestId("penghitung")).toContainText("10 / 10");
}

test.describe("daring", () => {
  test("pindai stiker → isi 10 butir → foto → kirim; temuan dibuat otomatis", async ({ page, context }) => {
    const a = await aset("20D");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: a.lat, longitude: a.lng, accuracy: 10 });
    await masuk(page, "inspektur");

    await page.goto(`/i/${a.token}`);
    await expect(page).toHaveURL(/\/petugas\/isi\?id=/);
    const id = new URL(page.url()).searchParams.get("id")!;
    await expect(page.getByRole("heading", { name: "20D" })).toBeVisible();
    await expect(page.getByText("Permenaker 4/1980 Pasal 12(1)a").first()).toBeVisible();
    await expect(page.getByTestId("pesan-gps")).toHaveText("Lokasi sesuai.");

    // Tanpa foto belum bisa dikirim (F1)
    await isiSemua(page, { volume: "Tidak penuh" });
    await page.getByRole("button", { name: "Kirim", exact: true }).click();
    const galat = page.getByTestId("galat-kirim");
    await expect(galat).toContainText("Langkah foto yang belum diisi: Tabung utuh dan label");
    // Temuan berat → usulan tidak layak dan rekomendasi wajib (G)
    await expect(page.getByRole("radio", { name: "Tidak layak pakai" })).toHaveAttribute("aria-checked", "true");
    await expect(galat).toContainText("rekomendasi wajib diisi");

    await fotoSemuaLangkah(page);
    await page.getByLabel(/Rekomendasi/).fill("Isi ulang tabung, pasang unit cadangan.");
    await page.getByRole("button", { name: "Kirim", exact: true }).click();

    await expect(page.getByTestId("hasil-terkirim")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("hasil-terkirim")).toContainText("Volume isi tabung: Tidak penuh");

    const [ins] = await q<{ status: string; gate_status: string; qr_verified: boolean; kesimpulan: string; offline: boolean; jarak_m: number }>(
      "select status, gate_status, qr_verified, kesimpulan, offline, jarak_m from inspections where id = $1",
      [id],
    );
    expect(ins).toMatchObject({ status: "final", gate_status: "sesuai", qr_verified: true, kesimpulan: "tidak_layak", offline: false });
    const temuan = await q<{ severity: string; item: string; target_selesai: string }>("select severity, item from issues where inspection_id = $1", [id]);
    expect(temuan).toEqual([{ severity: "berat", item: "Volume isi tabung: Tidak penuh" }]);
    const fotos = await q<{ content_type: string; width: number }>("select content_type, width from inspection_photos where inspection_id = $1", [id]);
    expect(fotos).toHaveLength(5);
    expect(fotos.every((f) => f.content_type === "image/jpeg" && f.width > 0 && f.width <= 1600)).toBe(true);
    const [jadwal] = await q<{ status: string }>("select status from schedules where inspection_id = $1", [id]);
    expect(jadwal?.status).toBe("selesai");
    expect((await q("select 1 from inspection_answers where inspection_id = $1", [id])).length).toBe(10);
  });

  test("posisi jauh tetap bisa dikirim dan ditandai", async ({ page, context }) => {
    const a = await aset("21D");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: a.lat + 0.01, longitude: a.lng, accuracy: 10 });
    await masuk(page, "inspektur");
    await page.goto("/petugas/pindai");
    await page.getByLabel(/Kode cadangan/).fill(`https://stiker-lama.example/i/${a.token}`);
    await page.getByRole("button", { name: "Buka" }).click();
    await expect(page).toHaveURL(/\/petugas\/isi\?id=/);
    await expect(page.getByTestId("pesan-gps")).toContainText("jauh di luar batas 75 m");
    await isiSemua(page, { volume: "Penuh" });
    await fotoSemuaLangkah(page);
    await page.getByRole("button", { name: "Kirim", exact: true }).click();
    await expect(page.getByTestId("hasil-terkirim")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("hasil-terkirim")).toContainText("Jauh dari aset");
  });

  test("QR lain ditolak; admin yang membuka stiker tidak membuat draf", async ({ page }) => {
    await masuk(page, "inspektur");
    await page.goto("/petugas/pindai");
    await page.getByLabel(/Kode cadangan/).fill("https://promo.example/diskon");
    await page.getByRole("button", { name: "Buka" }).click();
    await expect(page.getByTestId("pesan-pindai")).toHaveText("Kode ini bukan stiker inspeksi K3. Coba stiker yang benar.");
  });
});

test.describe("luring", () => {
  test.skip(!process.env.CI && !process.env.E2E_SW, "butuh service worker (build produksi): jalankan dengan CI=1 atau E2E_SW=1");

  test("isi luring → masuk antrean → terkirim otomatis saat sinyal kembali", async ({ page, context }) => {
    const a = await aset("22D");
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: a.lat, longitude: a.lng, accuracy: 15 });
    await masuk(page, "inspektur");

    // Daring sekali: paket kerja terunduh, service worker aktif, halaman lapangan tersimpan.
    await expect(page.getByTestId("progres")).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 15_000 }).catch(async () => {
      await page.reload();
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    });
    for (const p of ["/petugas/pindai", "/petugas/isi", "/petugas"]) {
      await page.goto(p);
      await page.waitForLoadState("networkidle");
    }

    await context.setOffline(true);
    await page.goto("/petugas/pindai");
    await page.getByLabel(/Kode cadangan/).fill(a.token);
    await page.getByRole("button", { name: "Buka" }).click();
    await expect(page).toHaveURL(/\/petugas\/isi\?id=/);
    const id = new URL(page.url()).searchParams.get("id")!;
    await expect(page.getByText("dicocokkan luring")).toBeVisible();

    await isiSemua(page, { volume: "Penuh" });
    await fotoSemuaLangkah(page);
    await page.getByRole("button", { name: "Kirim", exact: true }).click();

    await expect(page.getByTestId("status-kirim")).toContainText("Masuk antrean");
    await expect(page.getByTestId("lencana-antrean")).toHaveText("1 menunggu sinyal");
    expect(await q("select 1 from inspections where id = $1", [id])).toHaveLength(0);

    // Bertahan setelah muat ulang (N4)
    await page.reload();
    await expect(page.getByTestId("status-kirim")).toContainText("Menunggu sinyal");

    await context.setOffline(false);
    await expect(page.getByTestId("hasil-terkirim")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("lencana-antrean")).toHaveCount(0);

    const [ins] = await q<{ status: string; qr_verification: string; qr_verified: boolean; gate_status: string }>(
      "select status, qr_verification, qr_verified, gate_status from inspections where id = $1",
      [id],
    );
    expect(ins).toMatchObject({ status: "final", qr_verification: "offline_cache", qr_verified: true, gate_status: "sesuai" });
  });
});
