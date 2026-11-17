import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { Pool } from "pg";
import { masuk } from "../helpers";

/**
 * Area Laporan/Pemantau (SPEC §4.9, §5; ACCEPTANCE J, L, F5, G14).
 * Memakai data seed (APAR contoh, 6 inspeksi bulan ini, 1 temuan berat, foto contoh).
 */

let inspeksiId: string;
let asetId: number;
let kodeAset: string;

test.beforeAll(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query<{ id: string; asset_id: number; kode: string }>(
    `select i.id, i.asset_id, a.kode from inspections i
       join assets a on a.id = i.asset_id
       join asset_types t on t.id = a.asset_type_id
      where t.slug = 'apar' and i.status = 'final' and exists (select 1 from inspection_photos p where p.inspection_id = i.id)
      order by i.inspected_at desc limit 1`,
  );
  await pool.end();
  expect(rows[0], "seed harus membuat inspeksi final berfoto").toBeTruthy();
  inspeksiId = rows[0]!.id;
  asetId = rows[0]!.asset_id;
  kodeAset = rows[0]!.kode;
});

const bulanIni = () => {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  return { tahun: iso.slice(0, 4), bulan: iso.slice(5, 7) };
};

async function harusPdf(res: APIResponse, nama: RegExp) {
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect(res.headers()["content-disposition"]).toMatch(nama);
  expect(res.headers()["cache-control"]).toContain("no-store");
  const isi = await res.body();
  expect(isi.subarray(0, 5).toString()).toBe("%PDF-");
}

/** Halaman hanya baca: tidak ada formulir POST dan tidak ada tombol selain "Keluar". */
async function tanpaKendaliTulis(page: Page) {
  // Formulir "Keluar" di bilah samping bukan bagian halaman.
  await expect(page.locator('main form[method="post" i]')).toHaveCount(0);
  const tombol = await page.locator("main button, main [role=button]").allInnerTexts();
  expect(tombol.filter((t) => !/Tampilkan|Terapkan/.test(t))).toEqual([]);
}

// PDF dirender di peladen; di mesin lambat (dev server) bisa beberapa detik.
test.describe.configure({ timeout: 90_000 });

test.describe("pemantau", () => {
  test.beforeEach(async ({ page }) => {
    await masuk(page, "pemantau");
  });

  test("ringkasan manajemen lintas modul tanpa aksi tulis (J1-J3, PRD F14)", async ({ page }) => {
    await expect(page).toHaveURL(/\/pemantau$/);
    await expect(page.getByRole("heading", { name: "Papan pantau" })).toBeVisible();
    await expect(page.getByText("Ringkasan untuk manajemen")).toBeVisible();
    await expect(page.getByTestId("hanya-lihat")).toHaveText("Hanya lihat dan tinjau");
    await expect(page.getByTestId("narasi")).toContainText(/aset sudah diperiksa pada periodenya \(\d+,\d%\): APAR \d+\/\d+/);
    await expect(page.getByTestId("risiko").getByText("Berat").first()).toBeVisible();
    await expect(page.getByTestId("progres-modul")).toContainText("Mobil Pemadam · minggu ini");
    await expect(page.getByTestId("progres-gedung")).toBeVisible();
    await expect(page.getByText("Laporan siap cetak")).toBeVisible();
    await tanpaKendaliTulis(page);
  });

  test("tautan laporan siap cetak menghasilkan PDF (J4, L3)", async ({ page }) => {
    const { tahun, bulan } = bulanIni();
    await harusPdf(await page.request.get("/laporan/pms"), new RegExp(`filename="PMS-APAR-${tahun}-${bulan}\\.pdf"`));
    await harusPdf(await page.request.get("/laporan/temuan"), new RegExp(`filename="Rekap-Temuan-${tahun}-${bulan}\\.pdf"`));
    await page.getByRole("link", { name: "Pilih unit" }).click();
    await expect(page).toHaveURL(/\/pemantau\/laporan#kartu$/);
  });

  test("halaman laporan: filter, rincian per unit, unduhan, kartu kontrol (L5-L6)", async ({ page }) => {
    const { tahun, bulan } = bulanIni();
    await page.goto(`/pemantau/laporan?tipe=apar&tahun=${tahun}&bulan=${Number(bulan)}`);
    await expect(page.getByRole("heading", { name: "Laporan bulanan" })).toBeVisible();
    await expect(page.getByLabel("Tahun")).toHaveValue(tahun);
    const tabel = page.getByRole("table", { name: "Rincian per unit" });
    // Satu baris per unit (+ kepala), sama dengan angka di judul. Uji lain boleh menambah aset.
    const judul = await page.getByRole("heading", { name: /Rincian per unit/ }).innerText();
    const unit = Number(/\((\d+)\)/.exec(judul)![1]);
    expect(unit).toBeGreaterThanOrEqual(35);
    await expect(tabel.getByRole("row")).toHaveCount(unit + 1);
    await expect(tabel.getByText("Belum diperiksa").first()).toBeVisible();

    const unduhPms = page.getByRole("link", { name: "Lembar PMS (PDF)" });
    const href = await unduhPms.getAttribute("href");
    await harusPdf(await page.request.get(`${href}&unduh=1`), new RegExp(`attachment; filename="PMS-APAR-${tahun}-${bulan}\\.pdf"`));

    const kartu = tabel.getByRole("row").filter({ hasText: kodeAset }).getByRole("link", { name: `PDF ${tahun}` });
    await harusPdf(await page.request.get((await kartu.getAttribute("href"))!), new RegExp(`filename="Kartu-Kontrol-${kodeAset}-${tahun}\\.pdf"`));
  });

  test("filter laporan yang tidak sah ditolak; aset tak dikenal 404", async ({ page }) => {
    expect((await page.request.get("/laporan/pms?bulan=13")).status()).toBe(422);
    expect((await page.request.get("/laporan/pms?tipe=tidak-ada")).status()).toBe(404);
    expect((await page.request.get("/laporan/kartu/99999999")).status()).toBe(404);
    expect((await page.request.post("/laporan/pms")).status()).toBe(405);
  });

  test("detail inspeksi menampilkan foto bukti lewat rute bersesi (F5)", async ({ page }) => {
    await page.goto("/pemantau/inspeksi?tab=semua");
    await expect(page.getByRole("table", { name: "Daftar inspeksi" })).toBeVisible();
    await page.goto(`/pemantau/inspeksi/${inspeksiId}`);
    await expect(page.getByRole("heading", { name: `Inspeksi ${kodeAset}` })).toBeVisible();
    const foto = page.getByTestId("galeri-foto").getByRole("img").first();
    await foto.scrollIntoViewIfNeeded();
    await expect(foto).toHaveAttribute("src", /^\/api\/foto\/[0-9a-f-]{36}$/);
    // Gambar benar-benar termuat (bukan ikon rusak).
    await expect.poll(() => foto.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page.getByRole("table", { name: "Jawaban checklist" }).getByRole("row")).toHaveCount(11);
    await tanpaKendaliTulis(page);
  });

  test("daftar temuan hanya lihat, dengan saringan", async ({ page }) => {
    await page.goto("/pemantau/temuan");
    await expect(page.getByRole("heading", { name: "Temuan" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Daftar temuan" })).toContainText("Tekanan manometer: Kurang");
    await page.getByLabel("Tingkat").selectOption("ringan");
    await page.getByRole("button", { name: "Terapkan" }).click();
    await expect(page).toHaveURL(/tingkat=ringan/);
    // Hanya temuan ringan yang tampil (uji Admin boleh menambah temuan ringan).
    const tabel = page.getByRole("table", { name: "Daftar temuan" });
    if (await tabel.count()) {
      const tingkat = await tabel.locator("tbody tr td:nth-child(4)").allInnerTexts();
      expect(tingkat.every((t) => t.trim() === "Ringan")).toBe(true);
    } else {
      await expect(page.getByText("Tidak ada temuan untuk saringan ini.")).toBeVisible();
    }
    await tanpaKendaliTulis(page);
  });
});

test("admin tidak melihat ringkasan manajemen tetapi bisa mengunduh laporan (J1)", async ({ page }) => {
  await masuk(page, "admin");
  await page.goto("/pemantau");
  await expect(page.getByRole("heading", { name: "Papan pantau" })).toBeVisible();
  await expect(page.getByText("Ringkasan untuk manajemen")).toHaveCount(0);
  await harusPdf(await page.request.get(`/laporan/kartu/${asetId}`), /filename="Kartu-Kontrol-/);
  // Menu Admin "Laporan bulanan" membuka halaman laporan dengan kerangka admin.
  await page.goto("/laporan");
  await expect(page.getByRole("heading", { name: "Laporan bulanan" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu utama" }).getByRole("link", { name: /Tinjauan/ })).toBeVisible();
});

test("inspektur ditolak di laporan dan papan pantau (B2)", async ({ page }) => {
  await masuk(page, "inspektur");
  await page.goto("/pemantau/laporan");
  await expect(page).toHaveURL(/\/petugas$/);
  const res = await page.request.get("/laporan/pms", { maxRedirects: 0 });
  expect(res.headers()["content-type"] ?? "").not.toContain("application/pdf");
  expect([302, 303, 307, 403]).toContain(res.status());
});

test("tamu tidak bisa mengunduh PDF laporan", async ({ request }) => {
  const res = await request.get("/laporan/pms", { maxRedirects: 0 });
  expect(res.headers()["content-type"] ?? "").not.toContain("application/pdf");
  expect([302, 303, 307, 401]).toContain(res.status());
});

test.describe("cron jadwal (G14)", () => {
  test("tanpa CRON_SECRET yang benar ditolak", async ({ request }) => {
    expect((await request.get("/api/cron/jadwal")).status()).toBe(401);
    expect((await request.get("/api/cron/jadwal", { headers: { authorization: "Bearer salah" } })).status()).toBe(401);
  });

  test("dengan CRON_SECRET: idempoten, jadwal bulan ini lengkap", async ({ request }) => {
    test.skip(!process.env.CRON_SECRET, "CRON_SECRET tidak diatur di lingkungan uji");
    const headers = { authorization: `Bearer ${process.env.CRON_SECRET}` };
    const pertama = await request.get("/api/cron/jadwal", { headers });
    expect(pertama.status()).toBe(200);
    const kedua = await (await request.get("/api/cron/jadwal", { headers })).json();
    expect(Object.values(kedua.jadwalBaru)).toEqual([0, 0]);
    expect(kedua.ditautkan).toBe(0);

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await pool.query<{ aset: number; jadwal: number }>(
      `select (select count(*)::int from assets where aktif) as aset,
              (select count(*)::int from schedules where periode = $1::date) as jadwal`,
      [kedua.periode],
    );
    await pool.end();
    expect(rows[0]!.jadwal).toBe(rows[0]!.aset);
  });
});
