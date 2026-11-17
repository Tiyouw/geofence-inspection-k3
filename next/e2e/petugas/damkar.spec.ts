import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";
import { aset, q, tutup } from "../db-uji";
import { fotoSemuaLangkah, KAMERA_PALSU } from "../kamera-uji";
import { LANGKAH_FOTO_DAMKAR } from "../../src/lib/domain/modul/damkar";

/** PRD tab Mobil pemadam, F10, F16: objek bergerak tanpa gerbang lokasi, odometer, jadwal mingguan. */
test.use(KAMERA_PALSU);

test.afterAll(tutup);

test("mobil pemadam: 'Objek bergerak', 17 butir, odometer bukan temuan; temuan dengan tindakan; jadwal minggu ini", async ({
  page,
  context,
}) => {
  const a = await aset("PMK-01");
  // Posisi jauh dari mana pun: objek bergerak tidak pernah dinilai gerbang lokasi.
  await context.setGeolocation({ latitude: -6.2, longitude: 106.8, accuracy: 10 });
  await masuk(page, "inspektur");

  await page.goto(`/i/${a.token}`);
  await expect(page).toHaveURL(/\/petugas\/isi\?id=/);
  const id = new URL(page.url()).searchParams.get("id")!;
  await expect(page.getByRole("heading", { name: "PMK-01" })).toBeVisible();
  await expect(page.getByTestId("pesan-gps")).toHaveText("Objek bergerak: lokasi tidak diperiksa. Posisi tetap direkam sebagai informasi.");

  const pilih = async (label: string, nilai: string) =>
    page.getByRole("radiogroup", { name: label, exact: true }).getByRole("radio", { name: nilai, exact: true }).click();
  const baik = [
    "Oli mesin pada batas normal",
    "Air radiator pada batas normal",
    "Aki dan sistem pengisian normal",
    "Ban (tekanan, keausan, kerusakan)",
    "Lampu, rotator, dan sirene berfungsi",
    "Manometer pompa terbaca normal",
    "Selang dan kopling lengkap dan baik",
    "Nozzle lengkap",
    "APAR di kendaraan siap pakai",
    "Alat bantu pernapasan (SCBA) siap pakai",
    "Perlengkapan tersimpan aman dan mudah diambil",
  ];
  for (const label of baik) await pilih(label, "Baik");
  await pilih("Rem berfungsi", "Tidak baik");
  await pilih("Bahan bakar minimal 3/4 tangki", "Ya");
  await pilih("Tangki air penuh", "Tidak");
  await pilih("Tangki foam terisi", "Ya");
  await pilih("Pompa dapat dioperasikan (uji jalan singkat)", "Berfungsi");
  await page.getByLabel("Odometer", { exact: true }).fill("152340");
  await expect(page.getByTestId("penghitung")).toContainText("17 / 17");

  // Pratinjau temuan: tindakan bawaan dari butir, dapat diganti sebelum kirim.
  const pratinjau = page.getByTestId("pratinjau-temuan");
  await expect(pratinjau).toContainText("Temuan (2)");
  const rem = pratinjau.getByRole("listitem").filter({ hasText: "Rem berfungsi" });
  await expect(rem.getByRole("combobox")).toHaveValue("perbaiki");
  await rem.getByRole("combobox").selectOption("ganti");

  await fotoSemuaLangkah(page, LANGKAH_FOTO_DAMKAR.map((l) => l.judul));
  await page.getByLabel(/Rekomendasi/).fill("Kendaraan tidak dioperasikan sampai rem diperbaiki.");
  await page.getByRole("button", { name: "Kirim", exact: true }).click();
  await expect(page.getByTestId("hasil-terkirim")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("hasil-terkirim")).toContainText("Objek bergerak");

  const [ins] = await q<{ gate_status: string; kesimpulan: string }>("select gate_status, kesimpulan from inspections where id = $1", [id]);
  expect(ins).toEqual({ gate_status: "tidak_berlaku", kesimpulan: "tidak_layak" });
  const temuan = await q<{ item: string; severity: string; tindakan_rekomendasi: string; lokasi: string }>(
    "select item, severity, tindakan_rekomendasi, lokasi from issues where inspection_id = $1 order by item",
    [id],
  );
  expect(temuan).toEqual([
    { item: "Rem berfungsi: Tidak baik", severity: "berat", tindakan_rekomendasi: "ganti", lokasi: "Pos pemadam utama · PMK-01 · L 9101 XA" },
    { item: "Tangki air penuh: Tidak", severity: "berat", tindakan_rekomendasi: "isi_ulang", lokasi: "Pos pemadam utama · PMK-01 · L 9101 XA" },
  ]);
  const [odo] = await q<{ nilai_angka: number }>(
    `select a.nilai_angka from inspection_answers a join checklist_items i on i.id = a.checklist_item_id
      where a.inspection_id = $1 and i.label = 'Odometer'`,
    [id],
  );
  expect(odo?.nilai_angka).toBe(152340);

  // Jadwal mingguan: periode = Senin minggu ini, jatuh tempo = Minggu.
  const [j] = await q<{ periode: string; jatuh_tempo: string; status: string }>(
    "select to_char(periode, 'YYYY-MM-DD') periode, to_char(jatuh_tempo, 'YYYY-MM-DD') jatuh_tempo, status from schedules where inspection_id = $1",
    [id],
  );
  const senin = new Date(`${j!.periode}T00:00:00Z`);
  expect(senin.getUTCDay()).toBe(1);
  expect((Date.parse(`${j!.jatuh_tempo}T00:00:00Z`) - senin.getTime()) / 86_400_000).toBe(6);
  expect(j!.status).toBe("selesai");
});
