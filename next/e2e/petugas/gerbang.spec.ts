import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { masuk } from "../helpers";
import { aset, q, tutup } from "../db-uji";
import { fotoSemuaLangkah, KAMERA_PALSU } from "../kamera-uji";

/**
 * Gerbang lokasi poligon (PRD "Aturan gerbang lokasi", ADR-2/7). Geolokasi selalu dipalsukan.
 * Poligon yang dipakai adalah poligon SINTETIS dari seed demo (kotak di sekitar titik contoh).
 */
const M = 111_195;

test.use(KAMERA_PALSU);
test.afterAll(tutup);

type Poligon = { type: "Polygon"; coordinates: [number, number][][] };

/** Titik uji dari poligon area aset dan kawasan (batas utara + jarak, dalam meter). */
async function titikUji(kode: string) {
  const a = await aset(kode);
  const [area] = await q<{ polygon: Poligon }>("select ar.polygon from areas ar join assets s on s.area_id = ar.id where s.id = $1", [a.id]);
  const [kawasan] = await q<{ polygon: Poligon }>("select polygon from areas where jenis = 'kawasan' and aktif and polygon is not null order by id limit 1");
  if (!area || !kawasan) throw new Error("poligon contoh belum ada; jalankan pnpm db:seed dengan DEMO_MODE=true");
  const utara = (p: Poligon) => Math.max(...p.coordinates[0]!.map((c) => c[1]));
  const diUtara = (p: Poligon, m: number) => ({ latitude: utara(p) + m / M, longitude: a.lng });
  return {
    ...a,
    dalam: { latitude: a.lat, longitude: a.lng },
    luarGedung: diUtara(area.polygon, 80),
    jauh: diUtara(kawasan.polygon, 500),
  };
}

async function buka(page: Page, context: BrowserContext, token: string) {
  await masuk(page, "inspektur");
  await page.goto(`/i/${token}`);
  await expect(page).toHaveURL(/\/petugas\/isi\?id=/);
  return new URL(page.url()).searchParams.get("id")!;
}

async function isiLengkap(page: Page) {
  const pilih = async (label: string, nilai: string) =>
    page.getByRole("radiogroup", { name: label, exact: true }).getByRole("radio", { name: nilai, exact: true }).click();
  await pilih("Volume isi tabung", "Penuh");
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
  await fotoSemuaLangkah(page);
}

const kirim = (page: Page) => page.getByRole("button", { name: "Kirim", exact: true });

test("di dalam poligon gedung: lokasi sesuai", async ({ page, context }) => {
  const t = await titikUji("31D");
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...t.dalam, accuracy: 8 });
  const id = await buka(page, context, t.token);
  await expect(page.getByTestId("pesan-gps")).toContainText("Posisi Anda di");
  await expect(page.getByTestId("kartu-lokasi")).toContainText("Lokasi sesuai");
  await isiLengkap(page);
  await kirim(page).click();
  await expect(page.getByTestId("hasil-terkirim")).toBeVisible({ timeout: 20_000 });
  const [i] = await q("select gate_status, gate_alasan, jarak_ke_area_m from inspections where id = $1", [id]);
  expect(i).toMatchObject({ gate_status: "sesuai", gate_alasan: null, jarak_ke_area_m: 0 });
});

test("di galangan tetapi di luar gedung: diterima sebagai perlu tinjauan", async ({ page, context }) => {
  const t = await titikUji("32D");
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...t.luarGedung, accuracy: 10 });
  const id = await buka(page, context, t.token);
  await expect(page.getByTestId("pesan-gps")).toContainText("Inspeksi tetap terkirim dan akan ditinjau Pemantau.");
  await isiLengkap(page);
  await kirim(page).click();
  await expect(page.getByTestId("hasil-terkirim")).toBeVisible({ timeout: 20_000 });
  const [i] = await q<{ gate_status: string; gate_alasan: string; jarak_ke_area_m: number }>(
    "select gate_status, gate_alasan, jarak_ke_area_m from inspections where id = $1",
    [id],
  );
  expect(i).toMatchObject({ gate_status: "perlu_tinjauan", gate_alasan: "di_luar_gedung" });
  expect(i!.jarak_ke_area_m).toBeGreaterThanOrEqual(78);
});

test("jauh di luar galangan: ditolak, tetap draf, dicatat di jejak audit", async ({ page, context }) => {
  const t = await titikUji("33D");
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...t.jauh, accuracy: 10 });
  const id = await buka(page, context, t.token);
  await expect(page.getByTestId("pesan-gps")).toContainText("Posisi Anda berada di luar kawasan galangan");
  await isiLengkap(page);
  await kirim(page).click();
  await expect(page.getByTestId("status-kirim")).toContainText("Perlu tindakan", { timeout: 20_000 });
  await expect(page.getByTestId("status-kirim")).toContainText("Kirim ulang dari lokasi aset.");
  const [i] = await q("select status from inspections where id = $1", [id]);
  expect(i).toMatchObject({ status: "draf" });
  const audit = await q<{ data: { jarakKeKawasanM: number; lat: number } }>(
    "select data from audit_logs where aksi = 'inspeksi.ditolak_lokasi' and entitas_id = $1",
    [id],
  );
  expect(audit).toHaveLength(1);
  expect(audit[0]!.data.jarakKeKawasanM).toBeGreaterThanOrEqual(495);
  // Denah rahasia: koordinat penolakan tidak disimpan di jejak audit.
  expect(audit[0]!.data.lat).toBeUndefined();
});

test("sinyal lemah: penjelasan, pilihan tunggu atau kirim, akurasi disimpan", async ({ page, context }) => {
  const t = await titikUji("34D");
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...t.dalam, accuracy: 150 });
  const id = await buka(page, context, t.token);
  const pesan = page.getByTestId("pesan-gps");
  await expect(pesan).toContainText("Sinyal GPS lemah (akurasi ±150 m)");
  await expect(pesan).toContainText("lambung kapal");
  await expect(pesan).toContainText("dekat pintu atau area terbuka");
  await isiLengkap(page);
  await kirim(page).click();
  const dialog = page.getByTestId("dialog-sinyal-lemah");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Tunggu sinyal lebih baik" }).click();
  await expect(dialog).toBeHidden();
  await kirim(page).click();
  await page.getByTestId("dialog-sinyal-lemah").getByRole("button", { name: "Kirim sekarang" }).click();
  await expect(page.getByTestId("hasil-terkirim")).toBeVisible({ timeout: 20_000 });
  const [i] = await q("select gate_status, gate_alasan, gps_accuracy from inspections where id = $1", [id]);
  expect(i).toMatchObject({ gate_status: "perlu_tinjauan", gate_alasan: "gps_lemah", gps_accuracy: 150 });
});

test("lokasi mati atau izin ditolak: diblokir dengan ajakan dan Coba lagi", async ({ page, context }) => {
  const t = await titikUji("35D");
  await context.clearPermissions();
  await buka(page, context, t.token);
  const mati = page.getByTestId("lokasi-mati");
  await expect(mati).toBeVisible({ timeout: 15_000 });
  await expect(mati).toContainText("Nyalakan Lokasi (GPS) dan izinkan aplikasi memakainya, lalu tekan Coba lagi.");
  await expect(kirim(page)).toBeDisabled();

  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...t.dalam, accuracy: 8 });
  await page.getByTestId("coba-lagi-lokasi").click();
  await expect(mati).toBeHidden();
  await expect(page.getByTestId("pesan-gps")).toContainText("Posisi Anda di");
  await expect(kirim(page)).toBeEnabled();
});
