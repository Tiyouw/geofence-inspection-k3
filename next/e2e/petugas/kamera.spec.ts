import { expect, test, type Page } from "@playwright/test";
import { masuk } from "../helpers";
import { aset, q, tutup } from "../db-uji";
import { KAMERA_PALSU, LANGKAH_APAR } from "../kamera-uji";

/**
 * Kamera terpandu (PRD Aturan bukti 3, ADR-8): kamera belakang dari aplikasi tanpa galeri,
 * langkah demi langkah, beberapa jepretan per langkah, tinjau/ulangi/hapus, simpan sekaligus.
 */
test.use(KAMERA_PALSU);
test.afterAll(tutup);

async function bukaDraf(page: Page, kode: string) {
  const a = await aset(kode);
  await page.context().setGeolocation({ latitude: a.lat, longitude: a.lng, accuracy: 9 });
  await page.addInitScript(() => {
    const asli = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (!asli) return;
    navigator.mediaDevices.getUserMedia = (c) => {
      (window as unknown as { gum: unknown[] }).gum ??= [];
      (window as unknown as { gum: unknown[] }).gum.push(c);
      return asli(c);
    };
  });
  await masuk(page, "inspektur");
  await page.goto(`/i/${a.token}`);
  await expect(page).toHaveURL(/\/petugas\/isi\?id=/);
  return new URL(page.url()).searchParams.get("id")!;
}

async function isiSemua(page: Page) {
  const pilih = async (label: string, nilai: string) =>
    page.getByRole("radiogroup", { name: label, exact: true }).getByRole("radio", { name: nilai, exact: true }).click();
  await pilih("Volume isi tabung", "Penuh");
  await pilih("Tekanan manometer", "Zona hijau");
  await pilih("Badan tabung", "Mulus");
  for (const label of [
    "Segel dan mekanik penembus",
    "Handle dan tuas",
    "Label dan petunjuk pakai",
    "Mulut pancar tidak tersumbat",
    "Pipa atau selang pancar tidak retak",
    "Keterjangkauan dan ketinggian",
    "Tanda pemasangan dan kartu kontrol",
  ]) {
    await pilih(label, "Ada");
  }
}

test("langkah demi langkah: beberapa jepretan, ulangi, hapus, lalu simpan semua sekaligus", async ({ page }) => {
  const id = await bukaDraf(page, "25D");
  // Tanpa galeri atau pilih berkas.
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByTestId("progres-foto")).toHaveText("0/5 langkah");

  await page.getByTestId("buka-kamera").click();
  const kamera = page.getByTestId("kamera-terpandu");
  await expect(kamera.getByTestId("nomor-langkah")).toHaveText("Langkah 1 dari 5");
  await expect(kamera.getByTestId("judul-langkah")).toHaveText("Foto sekarang: Tabung utuh dan label");
  await expect(kamera.getByText(/Bukti untuk: Volume isi tabung, Badan tabung/)).toBeVisible();
  // Kamera belakang diminta dulu (exact).
  const gum = await page.evaluate(() => (window as unknown as { gum: { video: { facingMode?: unknown } }[] }).gum);
  expect(gum[0]!.video.facingMode).toEqual({ exact: "environment" });

  const jepret = kamera.getByRole("button", { name: "Jepret" });
  const lanjut = kamera.getByRole("button", { name: "Lanjut" });
  await expect(lanjut).toBeDisabled();
  await jepret.click();
  await expect(kamera.getByTestId("penghitung-jepretan")).toContainText("1/5 foto");
  await jepret.click();
  await expect(kamera.getByTestId("penghitung-jepretan")).toContainText("2/5 foto");
  // Jepretan sudah di perangkat, belum di antrean unggah.
  const antre = await page.evaluate(async (inspectionId) => {
    const dbs = await indexedDB.databases();
    const nama = dbs.find((d) => d.name?.startsWith("pal-k3:"))!.name!;
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = indexedDB.open(nama);
      r.onsuccess = () => ok(r.result);
    });
    const ambil = (store: string) =>
      new Promise<{ kind?: string; inspectionId: string; sesi?: boolean }[]>((ok) => {
        const r = db.transaction(store).objectStore(store).getAll();
        r.onsuccess = () => ok(r.result);
      });
    const [foto, outbox] = await Promise.all([ambil("photos"), ambil("outbox")]);
    db.close();
    return {
      sesi: foto.filter((f) => f.inspectionId === inspectionId && f.sesi).length,
      unggah: outbox.filter((o) => o.inspectionId === inspectionId && o.kind === "upload-photo").length,
    };
  }, id);
  expect(antre).toEqual({ sesi: 2, unggah: 0 });

  await lanjut.click();
  for (const [i, judul] of LANGKAH_APAR.slice(1).entries()) {
    await expect(kamera.getByTestId("judul-langkah")).toHaveText(`Foto sekarang: ${judul}`);
    await jepret.click();
    await expect(kamera.getByTestId("penghitung-jepretan")).toContainText("1/5 foto");
    await kamera.getByRole("button", { name: i === LANGKAH_APAR.length - 2 ? "Tinjau" : "Lanjut" }).click();
  }

  const tinjau = kamera.getByTestId("tinjau-foto");
  await expect(tinjau).toBeVisible();
  await expect(tinjau.getByTestId("tinjau-tabung")).toContainText("2 foto");

  // Hapus satu jepretan langkah pertama dari pratinjau.
  await tinjau.getByTestId("tinjau-tabung").getByRole("button", { name: "Foto Tabung utuh dan label" }).first().click();
  await kamera.getByTestId("pratinjau-foto").getByRole("button", { name: "Hapus foto" }).click();
  await expect(tinjau.getByTestId("tinjau-tabung")).toContainText("1 foto");

  // Ulangi langkah Manometer: jepretannya dibuang, kembali ke kamera, lalu langsung ke tinjau.
  await tinjau.getByTestId("tinjau-manometer").getByRole("button", { name: "Ulangi" }).click();
  await expect(kamera.getByTestId("judul-langkah")).toHaveText("Foto sekarang: Manometer");
  await expect(kamera.getByTestId("penghitung-jepretan")).toContainText("0/5 foto");
  await jepret.click();
  await jepret.click();
  await kamera.getByRole("button", { name: "Tinjau" }).click();
  await expect(tinjau.getByTestId("tinjau-manometer")).toContainText("2 foto");

  await kamera.getByRole("button", { name: "Simpan semua (6 foto)" }).click();
  await expect(kamera).toHaveCount(0);
  await expect(page.getByTestId("progres-foto")).toHaveText("5/5 langkah");
  await expect(page.getByTestId("langkah-manometer")).toContainText("2/5 foto");

  await isiSemua(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByTestId("hasil-terkirim")).toBeVisible({ timeout: 20_000 });

  const fotos = await q<{ width: number; height: number; taken_at_device: Date | null; lat: string | null; gps_accuracy: number | null; content_type: string; kode: string | null }>(
    `select f.width, f.height, f.taken_at_device, f.lat, f.gps_accuracy, f.content_type, s.kode
       from inspection_photos f left join photo_steps s on s.id = f.step_id where f.inspection_id = $1`,
    [id],
  );
  expect(fotos).toHaveLength(6);
  for (const f of fotos) {
    expect(f.content_type).toBe("image/jpeg");
    expect(Math.max(f.width, f.height)).toBeLessThanOrEqual(1600);
    expect(f.taken_at_device).not.toBeNull();
    expect(f.lat).not.toBeNull();
    expect(f.gps_accuracy).toBe(9);
  }
  // Satu foto untuk beberapa butir: tautan ke butir diturunkan dari langkahnya.
  expect(fotos.map((f) => f.kode).sort()).toEqual(["manometer", "manometer", "posisi", "segel", "selang", "tabung"]);
});

test("menutup kamera tanpa menyimpan membuang jepretan; kirim tanpa foto ditolak per langkah", async ({ page }) => {
  await bukaDraf(page, "27D");
  await page.getByTestId("buka-kamera").click();
  const kamera = page.getByTestId("kamera-terpandu");
  await kamera.getByRole("button", { name: "Jepret" }).click();
  await expect(kamera.getByTestId("penghitung-jepretan")).toContainText("1/5 foto");
  page.once("dialog", (d) => void d.accept());
  await kamera.getByRole("button", { name: "Tutup kamera" }).click();
  await expect(kamera).toHaveCount(0);
  await expect(page.getByTestId("progres-foto")).toHaveText("0/5 langkah");

  await isiSemua(page);
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByTestId("galat-kirim")).toContainText(`Langkah foto yang belum diisi: ${LANGKAH_APAR.join(", ")}`);
});

test("aset di area terbatas: tanpa kamera, dikirim dengan QR + GPS, otomatis ditandai", async ({ page }) => {
  const a = await aset("29D");
  const [lama] = await q<{ area_id: number | null }>("select area_id from assets where id = $1", [a.id]);
  const [area] = await q<{ id: number }>(
    `insert into areas (kode, nama, jenis, restricted) values ('UJI-TERBATAS', 'Bengkel Kapal Selam (uji)', 'bengkel', true)
     on conflict (kode) do update set restricted = true returning id`,
  );
  await q("update assets set area_id = $1 where id = $2", [area!.id, a.id]);
  try {
    const id = await bukaDraf(page, "29D");
    await expect(page.getByTestId("area-terbatas")).toContainText("Area terbatas (tanpa foto)");
    await expect(page.getByTestId("buka-kamera")).toHaveCount(0);
    await isiSemua(page);
    await page.getByRole("button", { name: "Kirim", exact: true }).click();
    await expect(page.getByTestId("hasil-terkirim")).toBeVisible({ timeout: 20_000 });
    const [ins] = await q<{ restricted_area: boolean }>("select restricted_area from inspections where id = $1", [id]);
    expect(ins!.restricted_area).toBe(true);
    expect(await q("select 1 from inspection_photos where inspection_id = $1", [id])).toHaveLength(0);
  } finally {
    await q("update assets set area_id = $1 where id = $2", [lama!.area_id, a.id]);
  }
});
