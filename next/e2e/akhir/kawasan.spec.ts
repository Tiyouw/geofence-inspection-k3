import { expect, test } from "@playwright/test";
import { masuk, setujuiDialog } from "../helpers";
import { aset, q, tutup } from "../db-uji";

/**
 * Regresi: batas kawasan hasil impor harus bisa dijadikan kawasan walau semua aset berada di
 * dalam poligonnya. Dulu hitungan aset memakai subkueri yang terikat ke assets.id, sehingga
 * area baru tanpa aset ditolak dengan "Area ini masih memiliki aset".
 * Berjalan di proyek "akhir" (setelah uji lain) karena mengganti kawasan aktif; keadaan dipulihkan.
 * GeoJSON SINTETIS saja.
 */
test.afterAll(tutup);

const M = 111_195;

test("impor batas kawasan lalu jadikan kawasan, dengan aset di dalam poligon", async ({ page }) => {
  const a = await aset("29D");
  const unik = Date.now().toString(36).slice(-5).toUpperCase();
  const nama = `Kawasan Uji ${unik}`;
  const dLat = 5000 / M;
  const dLng = 5000 / (M * Math.cos((a.lat * Math.PI) / 180));
  const fc = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { label: nama },
        geometry: {
          type: "Polygon",
          coordinates: [[[a.lng - dLng, a.lat - dLat], [a.lng + dLng, a.lat - dLat], [a.lng + dLng, a.lat + dLat], [a.lng - dLng, a.lat + dLat], [a.lng - dLng, a.lat - dLat]]],
        },
      },
    ],
  };

  const [lama] = await q<{ id: number }>("select id from areas where jenis = 'kawasan' and aktif order by id limit 1");
  // Keadaan yang memicu bug lama: ada aset yang area_id-nya sama dengan id aset itu sendiri.
  const [kembar] = await q<{ id: number; area_id: number | null }>(
    "select s.id, s.area_id from assets s join areas ar on ar.id = s.id where ar.jenis <> 'kawasan' and ar.aktif order by s.id limit 1",
  );
  if (kembar) await q("update assets set area_id = id where id = $1", [kembar.id]);
  let baru: number | undefined;
  try {
    await masuk(page, "admin");
    await page.goto("/admin/lokasi");
    await page.getByTestId("berkas-geojson").setInputFiles({
      name: "kawasan-sintetis.geojson",
      mimeType: "application/geo+json",
      buffer: Buffer.from(JSON.stringify(fc)),
    });
    const impor = page.getByTestId("panel-impor");
    await impor.getByRole("button", { name: "Impor 1 poligon" }).click();
    await expect(impor).toBeHidden();
    [{ id: baru }] = await q<{ id: number }>("select id from areas where nama = $1", [nama]);
    expect(await q("select count(*)::int n from assets where area_id = $1", [baru])).toEqual([{ n: 0 }]);

    await page.getByLabel("Cari area").fill(nama);
    await page.getByTestId("daftar-area").getByRole("button", { name: new RegExp(nama) }).click();
    await page.getByTestId("panel-area").getByRole("button", { name: "Jadikan batas kawasan" }).click();
    await setujuiDialog(page, "Jadikan batas kawasan");
    await expect(page.getByText("Batas kawasan galangan diperbarui.")).toBeVisible();
    await expect(page.getByText("Area ini masih memiliki aset")).toHaveCount(0);

    expect(await q("select jenis, aktif from areas where id = $1", [baru])).toEqual([{ jenis: "kawasan", aktif: true }]);
    // Aset tidak pernah dipasangkan ke kawasan.
    expect(await q("select count(*)::int n from assets where area_id = $1", [baru])).toEqual([{ n: 0 }]);
  } finally {
    if (kembar) await q("update assets set area_id = $2 where id = $1", [kembar.id, kembar.area_id]);
    if (baru && lama) {
      await q("update areas set aktif = false, jenis = 'gedung' where id = $1", [baru]);
      await q("update areas set aktif = true where id = $1", [lama.id]);
      await q("update areas set parent_id = $1 where parent_id = $2", [lama.id, baru]);
    }
  }
});
