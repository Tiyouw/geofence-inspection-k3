import { expect, test, type Page } from "@playwright/test";
import { DEFINISI_P3K } from "../../src/lib/domain/modul/p3k";
import { semuaButir } from "../../src/lib/domain/modul/tipe";
import { aset, q, tutup } from "../db-uji";
import { fotoSemuaLangkah, KAMERA_PALSU } from "../kamera-uji";

/**
 * PRD Checklist per modul, Kotak P3K: isi kotak dicatat jumlah, kondisi, dan kedaluwarsa terdekat;
 * temuan otomatis dari isi kurang dan kedaluwarsa. Masuk sebagai inspektur Divisi Matra & K3LH (2004).
 */
const ISI = semuaButir(DEFINISI_P3K).filter((b) => b.baku);

test.use(KAMERA_PALSU);
test.afterAll(tutup);

async function masukP3k(page: Page) {
  test.skip(!process.env.SEED_SANDI_AWAL, "SEED_SANDI_AWAL diperlukan untuk akun 2004");
  await page.goto("/masuk");
  await page.getByLabel(/NIP/).fill("2004");
  await page.getByLabel("Kata sandi", { exact: true }).fill(process.env.SEED_SANDI_AWAL!);
  await page.getByRole("button", { name: /^Masuk/ }).click();
  await expect(page).not.toHaveURL(/\/masuk/, { timeout: 15_000 });
}

test("kotak P3K tipe C: isi kurang dan kedaluwarsa menjadi temuan, kelengkapan tercatat", async ({ page, context }) => {
  const a = await aset("P3K-07");
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: a.lat, longitude: a.lng, accuracy: 10 });
  await masukP3k(page);

  await page.goto(`/i/${a.token}`);
  await expect(page).toHaveURL(/\/petugas\/isi\?id=/);
  const id = new URL(page.url()).searchParams.get("id")!;
  await expect(page.getByRole("heading", { name: "P3K-07" })).toBeVisible();

  for (const label of semuaButir(DEFINISI_P3K).filter((b) => !b.baku).map((b) => b.label)) {
    await page.getByRole("radiogroup", { name: label, exact: true }).getByRole("radio", { name: "Baik", exact: true }).click();
  }
  // Baku tipe C, kecuali Plester cepat (12 dari 20).
  for (const b of ISI) {
    await page.getByLabel(`Jumlah ${b.label}`, { exact: true }).fill(String(b.label === "Plester cepat" ? 12 : b.baku!.C));
    await expect(page.getByLabel(`Jumlah ${b.label}`, { exact: true })).toHaveValue(String(b.label === "Plester cepat" ? 12 : b.baku!.C));
    await page.getByRole("radiogroup", { name: `Kondisi ${b.label}`, exact: true }).getByRole("radio", { name: "Aman" }).click();
    if (b.adaKedaluwarsa) await page.getByLabel(`Kedaluwarsa terdekat ${b.label}`).fill("2027-08-31");
  }
  await expect(page.getByText("Kurang 8 dari baku.")).toBeVisible();

  // Tanggal sudah lewat padahal "Aman": peringatan, dan kirim ditolak.
  await page.getByLabel("Kedaluwarsa terdekat Povidon iodin (60 ml)").fill("2026-01-31");
  await expect(page.getByText(/Tanggal sudah lewat/)).toBeVisible();
  await fotoSemuaLangkah(page, DEFINISI_P3K.langkahFoto.map((l) => l.judul));
  await page.getByLabel(/Rekomendasi/).fill("Lengkapi plester dan ganti povidon iodin.");
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByTestId("galat-kirim")).toContainText('Tanggal kedaluwarsa "Povidon iodin (60 ml)" sudah lewat');

  await page.getByRole("radiogroup", { name: "Kondisi Povidon iodin (60 ml)", exact: true }).getByRole("radio", { name: "Ada yang kedaluwarsa" }).click();
  await expect(page.getByRole("radio", { name: "Layak dengan catatan" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Kirim", exact: true }).click();

  await expect(page.getByTestId("hasil-terkirim")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("hasil-terkirim")).toContainText("Plester cepat: 12 dari 20 buah, kurang 8");

  const temuan = await q<{ severity: string; item: string }>("select severity, item from issues where inspection_id = $1 order by item", [id]);
  expect(temuan).toEqual([
    { severity: "sedang", item: "Plester cepat: 12 dari 20 buah, kurang 8" },
    { severity: "sedang", item: "Povidon iodin (60 ml): ada yang kedaluwarsa (terdekat 31 Jan 2026)" },
  ]);
  const [ins] = await q<{ kesimpulan: string }>("select kesimpulan from inspections where id = $1", [id]);
  expect(ins?.kesimpulan).toBe("layak_catatan");
  const isi = await q<{ n: number }>(
    "select count(*)::int as n from inspection_answers where inspection_id = $1 and kondisi_isi is not null",
    [id],
  );
  expect(isi[0]?.n).toBe(ISI.length);
});
