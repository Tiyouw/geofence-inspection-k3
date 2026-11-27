import { execFileSync } from "node:child_process";
import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { masuk } from "../helpers";
import { q, tutup } from "../db-uji";

/**
 * Lapisan data demo (pnpm db:demo / db:demo:reset): idempoten, tampil di halaman dan laporan PDF,
 * dan reset hanya menghapus baris demo. Di proyek "demo" (paling akhir, sendirian) karena menambah lalu menghapus data.
 */
test.afterAll(tutup);

const demo = (...args: string[]) =>
  execFileSync("npx", ["tsx", "src/db/seed/demo-cli.ts", ...args], { encoding: "utf8", env: process.env, timeout: 120_000 });

/** Sidik jari data NON-demo: harus sama sebelum seed, sesudah seed, dan sesudah reset. */
async function sidikNonDemo() {
  return q(`
    select
      (select count(*)::int from areas where kode not like 'DEMO-%') as area,
      (select md5(coalesce(string_agg(id || kode || coalesce(polygon::text, '') || aktif, ',' order by id), '')) from areas where kode not like 'DEMO-%') as area_md5,
      (select count(*)::int from assets where kode not like 'DEMO-%') as aset,
      (select count(*)::int from inspections i join assets a on a.id = i.asset_id where a.kode not like 'DEMO-%') as inspeksi,
      (select count(*)::int from issues i join assets a on a.id = i.asset_id where a.kode not like 'DEMO-%') as temuan,
      (select count(*)::int from users where nip not in ('inspektur.satpk', 'inspektur.matra', 'pemantau.satpk', 'pemantau.matra')) as akun`);
}

async function harusPdf(res: APIResponse) {
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
}

async function masukSebagai(page: Page, nip: string, sandi: string) {
  await page.goto("/masuk");
  await page.getByLabel(/NIP/).fill(nip);
  await page.getByLabel("Kata sandi", { exact: true }).fill(sandi);
  await page.getByRole("button", { name: /^Masuk/ }).click();
  await expect(page).not.toHaveURL(/\/masuk/, { timeout: 15_000 });
}

test.describe.serial("data demo", () => {
  let sebelum: unknown;

  test("rencana tidak menyimpan; seed idempoten; data non-demo tidak berubah", async () => {
    test.setTimeout(240_000);
    demo("reset");
    sebelum = await sidikNonDemo();
    expect(demo("seed", "--rencana")).toMatch(/Akan ditambahkan:[\s\S]*aset\s+17/);
    expect(await q("select count(*)::int n from assets where kode like 'DEMO-%'")).toEqual([{ n: 0 }]);
    expect(demo("seed")).toMatch(/inspeksi_final\s+26/);
    expect(demo("seed")).toContain("Inspeksi demo sudah ada");
    expect(await sidikNonDemo()).toEqual(sebelum);
    const [jumlah] = await q(`
      select
        (select count(*)::int from areas where kode like 'DEMO-%') as area,
        (select count(*)::int from assets where kode like 'DEMO-%') as aset,
        (select count(*)::int from inspections i join assets a on a.id = i.asset_id where a.kode like 'DEMO-%' and i.status = 'final') as final,
        (select count(*)::int from inspections i join assets a on a.id = i.asset_id
          where a.kode like 'DEMO-%' and i.hasil_tinjauan is null and (i.gate_status = 'perlu_tinjauan' or i.restricted_area)) as antrean,
        (select count(*)::int from audit_logs where aksi = 'inspeksi.ditolak_lokasi' and data->>'demo' = 'true') as ditolak`);
    expect(jumlah).toEqual({ area: 8, aset: 17, final: 26, antrean: 4, ditolak: 1 });
  });

  test("admin: antrean tinjauan, daftar aset, editor area", async ({ page }) => {
    await masuk(page, "admin");
    await page.goto("/admin/tinjauan");
    await expect(page.getByText("DEMO-A03").first()).toBeVisible();
    await expect(page.getByText("DEMO-A07").first()).toBeVisible();
    await page.goto("/admin/aset?q=DEMO-");
    await expect(page.getByText("DEMO-A09").first()).toBeVisible();
    await page.goto("/admin/lokasi");
    await page.getByLabel("Cari area").fill("Bengkel Fabrikasi Demo");
    await expect(page.getByTestId("daftar-area")).toContainText("Bengkel Fabrikasi Demo");
  });

  test("pemantau SAT. PK (akun demo): laporan PDF bulan ini dan bulan lalu", async ({ page }) => {
    await masukSebagai(page, "pemantau.satpk", process.env.DEMO_PEMANTAU_PASSWORD || "pemantau123");
    const kini = new Date();
    const lalu = new Date(kini.getFullYear(), kini.getMonth() - 1, 15);
    for (const url of [
      "/laporan/pms",
      `/laporan/pms?tahun=${lalu.getFullYear()}&bulan=${lalu.getMonth() + 1}`,
      "/laporan/temuan",
      "/laporan/progres",
      "/laporan/isi-p3k",
    ]) {
      await harusPdf(await page.request.get(url));
    }
  });

  test("inspektur Matra (akun demo): riwayat berisi inspeksi demo", async ({ page }) => {
    await masukSebagai(page, "inspektur.matra", process.env.DEMO_INSPEKTUR_PASSWORD || "inspektur123");
    await page.goto("/petugas/riwayat");
    await expect(page.getByText(/DEMO-P0[12]/).first()).toBeVisible({ timeout: 15_000 });
  });

  test("reset: rencana tidak menghapus; reset menghapus hanya data demo", async () => {
    test.setTimeout(240_000);
    expect(demo("reset", "--rencana")).toMatch(/Akan dihapus \(hanya data demo\):[\s\S]*aset\s+17/);
    expect(await q("select count(*)::int n from assets where kode like 'DEMO-%'")).toEqual([{ n: 17 }]);
    demo("reset");
    expect(await sidikNonDemo()).toEqual(sebelum);
    expect(
      await q(`select (select count(*)::int from areas where kode like 'DEMO-%') a, (select count(*)::int from assets where kode like 'DEMO-%') b,
        (select count(*)::int from audit_logs where data->>'demo' = 'true') c`),
    ).toEqual([{ a: 0, b: 0, c: 0 }]);
  });
});
