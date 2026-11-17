import { expect, test } from "@playwright/test";
import { masuk, setujuiDialog } from "../helpers";
import { aset, q, tutup } from "../db-uji";

/**
 * Hapus draf massal per kumpulan impor. Hanya draf yang belum disetujui dan tanpa aset yang
 * terhapus; dialog menyebut jumlahnya. GeoJSON SINTETIS saja. Di proyek "akhir" karena
 * meminjam aset 29D sebentar.
 */
test.afterAll(tutup);

const M = 111_195;

test("hapus satu kumpulan impor: hanya draf tanpa aset, area disetujui tetap ada", async ({ page }) => {
  const a = await aset("29D");
  const unik = Date.now().toString(36).slice(-5).toUpperCase();
  const kotak = (n: number) => {
    const x0 = a.lng + (3000 + n * 100) / (M * Math.cos((a.lat * Math.PI) / 180));
    const y0 = a.lat;
    const dx = 50 / (M * Math.cos((a.lat * Math.PI) / 180));
    const dy = 50 / M;
    return { type: "Polygon", coordinates: [[[x0, y0], [x0 + dx, y0], [x0 + dx, y0 + dy], [x0, y0 + dy], [x0, y0]]] };
  };
  const nama = (n: number) => `Hapus Uji ${unik} ${n}`;
  const fc = {
    type: "FeatureCollection",
    features: [1, 2, 3, 4].map((n) => ({ type: "Feature", properties: { label: nama(n) }, geometry: kotak(n) })),
  };

  await masuk(page, "admin");
  await page.goto("/admin/lokasi");
  await page.getByTestId("berkas-geojson").setInputFiles({
    name: "draf-sintetis.geojson",
    mimeType: "application/geo+json",
    buffer: Buffer.from(JSON.stringify(fc)),
  });
  await page.getByTestId("panel-impor").getByRole("button", { name: "Impor 4 poligon" }).click();
  await expect(page.getByTestId("panel-impor")).toBeHidden();
  const rows = await q<{ id: number; nama: string }>("select id, nama from areas where nama like $1 order by nama", [`Hapus Uji ${unik} %`]);
  expect(rows).toHaveLength(4);
  const [satu, dua] = rows;

  const kumpulan = page.getByTestId("hapus-draf").getByRole("listitem").filter({ hasText: unik });
  await expect(kumpulan).toContainText("4 draf");

  // Area 1 disetujui, area 2 berisi aset: keduanya tidak boleh ikut terhapus.
  const bukaArea = async (n: string) => {
    await page.getByLabel("Cari area").fill(n);
    await page.getByTestId("daftar-area").getByRole("button", { name: new RegExp(n) }).click();
  };
  await bukaArea(satu!.nama);
  await page.getByTestId("panel-area").getByRole("button", { name: "Setujui poligon" }).click();
  await setujuiDialog(page, "Setujui poligon");
  await expect(page.getByTestId("panel-area")).toContainText("Poligon disetujui");
  await page.getByRole("button", { name: "Tutup" }).click();
  const [awal] = await q<{ area_id: number | null }>("select area_id from assets where id = $1", [a.id]);
  await q("update assets set area_id = $1 where id = $2", [dua!.id, a.id]);
  try {
    await page.reload();
    await expect(kumpulan).toContainText("2 draf");

    await kumpulan.getByRole("button", { name: "Hapus 2" }).click();
    const dialog = page.getByTestId("dialog-hapus-draf");
    await expect(dialog).toContainText("Hapus 2 draf area?");
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toBeHidden();
    expect(await q("select count(*)::int n from areas where nama like $1", [`Hapus Uji ${unik} %`])).toEqual([{ n: 4 }]);

    await kumpulan.getByRole("button", { name: "Hapus 2" }).click();
    await dialog.getByRole("button", { name: "Hapus 2 draf" }).click();
    await expect(page.getByText("2 draf area dihapus.")).toBeVisible();
    await expect(kumpulan).toHaveCount(0);
    expect((await q<{ nama: string }>("select nama from areas where nama like $1 order by nama", [`Hapus Uji ${unik} %`])).map((r) => r.nama)).toEqual([
      satu!.nama,
      dua!.nama,
    ]);
  } finally {
    await q("update assets set area_id = $1 where id = $2", [awal!.area_id, a.id]);
    await q("update areas set aktif = false where nama like $1", [`Hapus Uji ${unik} %`]);
  }
});
