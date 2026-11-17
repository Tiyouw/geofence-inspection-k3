import { expect, test } from "@playwright/test";
import { masuk, pilih, setujuiDialog } from "../helpers";
import { aset, q, tutup } from "../db-uji";

/**
 * Editor area (PRD "Impor denah", ADR-10). GeoJSON SINTETIS saja: denah asli rahasia dan
 * tidak boleh masuk repo. Kotak-kotak diletakkan ~2 km dari titik contoh seed.
 */
test.afterAll(tutup);

const M = 111_195;
function kotak(lat: number, lng: number, timurM: number, utaraM: number, lebarM: number, tinggiM: number) {
  const dLng = (m: number) => m / (M * Math.cos((lat * Math.PI) / 180));
  const x0 = lng + dLng(timurM);
  const y0 = lat + utaraM / M;
  const x1 = x0 + dLng(lebarM);
  const y1 = y0 + tinggiM / M;
  return { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] };
}

test("impor GeoJSON → pratinjau → draf; ubah atribut, setujui, sunting simpul, pasangkan aset, hapus", async ({ page }) => {
  test.setTimeout(60_000);
  const a = await aset("29D");
  const unik = Date.now().toString(36).slice(-5).toUpperCase();
  const fc = {
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { label: `Bengkel Uji ${unik}` }, geometry: kotak(a.lat, a.lng, 2000, 0, 80, 50) },
      { type: "Feature", properties: { name: `Dok Uji ${unik}` }, geometry: kotak(a.lat, a.lng, 2200, 0, 60, 120) },
      {
        type: "Feature",
        properties: { label: "Pita" },
        geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1], [1, 0], [0, 1], [0, 0]]] },
      },
    ],
  };

  await masuk(page, "admin");
  await page.goto("/admin/lokasi");
  await expect(page.getByRole("heading", { name: "Area dan poligon" })).toBeVisible();
  await expect(page.getByTestId("peta-area")).toBeVisible();

  await page.getByTestId("berkas-geojson").setInputFiles({
    name: "uji-sintetis.geojson",
    mimeType: "application/geo+json",
    buffer: Buffer.from(JSON.stringify(fc)),
  });
  const impor = page.getByTestId("panel-impor");
  await expect(impor).toContainText("2 poligon siap diimpor");
  await expect(impor).toContainText("1 dilewati");
  await expect(impor).toContainText("Poligon tidak sah: garis saling memotong.");
  await expect(page.locator('[data-testid="peta-area"] path.poligon-impor')).toHaveCount(2);
  await impor.getByRole("button", { name: "Impor 2 poligon" }).click();
  await expect(impor).toBeHidden();

  const rows = await q<{ id: number; nama: string; polygon: unknown; polygon_draf: unknown }>(
    "select id, nama, polygon, polygon_draf from areas where nama like $1 order by nama",
    [`%Uji ${unik}`],
  );
  expect(rows.map((r) => r.nama)).toEqual([`Bengkel Uji ${unik}`, `Dok Uji ${unik}`]);
  expect(rows.every((r) => r.polygon === null && r.polygon_draf !== null)).toBe(true);
  const bengkel = rows[0]!;

  // Pilih dari daftar, ubah atribut
  await page.getByLabel("Cari area").fill(`Bengkel Uji ${unik}`);
  await page.getByTestId("daftar-area").getByRole("button", { name: new RegExp(`Bengkel Uji ${unik}`) }).click();
  const panel = page.getByTestId("panel-area");
  await expect(panel).toContainText("Ada draf");
  // Sorotan: satu garis aksen di atas garis putih, pin bernama di kutub label, yang lain diredupkan.
  const peta = page.getByTestId("peta-area");
  await expect(peta.locator("path.poligon-terpilih")).toHaveCount(1);
  await expect(peta.locator("path.poligon-terpilih")).toHaveAttribute("stroke", "#f5b700");
  await expect(peta.locator(".pin-terpilih")).toContainText(`Bengkel Uji ${unik}`);
  await expect(peta.locator(".pin-terpilih:not(.pin-kawasan)")).toHaveCount(1);
  await expect(peta.locator("path.poligon-area").first()).toHaveAttribute("stroke-opacity", "0.35");
  await expect(page.getByTestId("legenda-terpilih")).toHaveText("Terpilih");
  await panel.getByLabel("Nama", { exact: true }).fill(`Bengkel Las ${unik}`);
  await pilih(panel.getByLabel("Jenis"), "Bengkel");
  await pilih(panel.getByLabel("Unit kerja"), 1);
  await panel.getByRole("checkbox").check();
  await panel.getByRole("button", { name: "Simpan atribut" }).click();
  await expect.poll(async () => (await q("select nama, jenis, restricted, division_id is not null as unit from areas where id = $1", [bengkel.id]))[0]).toEqual({
    nama: `Bengkel Las ${unik}`,
    jenis: "bengkel",
    restricted: true,
    unit: true,
  });

  // Setujui: draf menjadi poligon resmi
  await panel.getByRole("button", { name: "Setujui poligon" }).click();
  await setujuiDialog(page, "Setujui poligon");
  await expect(panel).toContainText("Poligon disetujui");
  const [resmi] = await q<{ polygon: { coordinates: number[][][] }; polygon_draf: unknown }>(
    "select polygon, polygon_draf from areas where id = $1",
    [bengkel.id],
  );
  expect(resmi!.polygon_draf).toBeNull();

  // Sunting simpul: geser simpul pertama, simpan sebagai draf
  await panel.getByRole("button", { name: "Sunting simpul" }).click();
  const simpul = page.locator(".simpul-poligon:not(.simpul-tengah)").first();
  await expect(simpul).toBeVisible();
  const kotakSimpul = (await simpul.boundingBox())!;
  await page.mouse.move(kotakSimpul.x + 7, kotakSimpul.y + 7);
  await page.mouse.down();
  await page.mouse.move(kotakSimpul.x - 30, kotakSimpul.y + 40, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Simpan draf" }).click();
  await expect
    .poll(async () => (await q<{ d: { coordinates: number[][][] } | null }>("select polygon_draf as d from areas where id = $1", [bengkel.id]))[0]!.d)
    .not.toBeNull();
  const [draf] = await q<{ d: { coordinates: number[][][] } }>("select polygon_draf as d from areas where id = $1", [bengkel.id]);
  expect(draf!.d.coordinates[0]).not.toEqual(resmi!.polygon.coordinates[0]);

  // Pasangkan aset (panel area tetap terbuka setelah simpan draf)
  await expect(panel).toContainText("Ada draf");
  await pilih(page.getByLabel("Aset untuk dipasangkan"), /^29D · /);
  await page.getByRole("button", { name: "Pasangkan", exact: true }).click();
  await expect(page.getByTestId("aset-area")).toContainText("29D");
  expect((await q("select area_id from assets where id = $1", [a.id]))[0]).toEqual({ area_id: bengkel.id });

  // Lepas lagi supaya data seed tetap utuh, lalu hapus area dok
  await page.getByTestId("aset-area").getByRole("button", { name: "Lepas" }).click();
  await expect(page.getByTestId("aset-area")).not.toContainText("29D");
  await page.getByRole("button", { name: "Tutup" }).click();
  // Batal pilih: sorotan hilang, kecerahan kembali.
  await expect(page.locator('[data-testid="peta-area"] path.poligon-terpilih')).toHaveCount(0);
  await expect(page.locator('[data-testid="peta-area"] .pin-terpilih')).toHaveCount(0);
  await expect(page.locator('[data-testid="peta-area"] path.poligon-area').first()).toHaveAttribute("stroke-opacity", "1");
  await page.getByLabel("Cari area").fill(`Dok Uji ${unik}`);
  await page.getByTestId("daftar-area").getByRole("button", { name: new RegExp(`Dok Uji ${unik}`) }).click();
  await page.getByRole("button", { name: "Hapus area" }).click();
  await setujuiDialog(page, "Hapus area");
  await expect.poll(async () => (await q("select aktif from areas where id = $1", [rows[1]!.id]))[0]).toEqual({ aktif: false });
});

test("berkas bukan GeoJSON ditolak dengan pesan", async ({ page }) => {
  await masuk(page, "admin");
  await page.goto("/admin/lokasi");
  await page.getByTestId("berkas-geojson").setInputFiles({ name: "x.json", mimeType: "application/json", buffer: Buffer.from("bukan json") });
  await expect(page.getByText("Berkas bukan JSON yang sah.")).toBeVisible();
});

test("pemantau tidak dapat membuka editor area", async ({ page }) => {
  await masuk(page, "pemantau");
  await page.goto("/admin/lokasi");
  await expect(page).not.toHaveURL(/\/admin\/lokasi/);
});
