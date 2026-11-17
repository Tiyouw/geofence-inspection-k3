import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";
import { aset, q, tutup } from "../db-uji";

/**
 * Setujui massal per kumpulan impor: calon batas kawasan dilewati dengan alasan, dialog menyebut
 * jumlahnya, peladen menyetujui tepat yang lolos. GeoJSON SINTETIS saja.
 */
test.afterAll(tutup);

const M = 111_195;

test("setujui satu kumpulan impor: gedung disetujui, calon kawasan dilewati", async ({ page }) => {
  const a = await aset("29D");
  const unik = Date.now().toString(36).slice(-5).toUpperCase();
  const kotak = (n: number) => {
    const k = M * Math.cos((a.lat * Math.PI) / 180);
    const x0 = a.lng + (4000 + n * 100) / k;
    const y0 = a.lat - 3000 / M;
    return { type: "Polygon", coordinates: [[[x0, y0], [x0 + 50 / k, y0], [x0 + 50 / k, y0 + 50 / M], [x0, y0 + 50 / M], [x0, y0]]] };
  };
  const nama = [`Gedung Massal ${unik} A`, `Gedung Massal ${unik} B`, `Kawasan Massal ${unik}`];
  const fc = { type: "FeatureCollection", features: nama.map((n, i) => ({ type: "Feature", properties: { label: n }, geometry: kotak(i) })) };

  try {
    await masuk(page, "admin");
    await page.goto("/admin/lokasi");
    await page.getByTestId("berkas-geojson").setInputFiles({
      name: "massal-sintetis.geojson",
      mimeType: "application/geo+json",
      buffer: Buffer.from(JSON.stringify(fc)),
    });
    await page.getByTestId("panel-impor").getByRole("button", { name: "Impor 3 poligon" }).click();
    await expect(page.getByTestId("panel-impor")).toBeHidden();

    const kartu = page.getByTestId("draf-massal");
    await expect(kartu).toBeVisible();
    await expect(page.getByText("Draf massal", { exact: true })).toBeVisible();
    const kumpulan = kartu.getByRole("listitem").filter({ hasText: unik });
    await expect(kumpulan).toContainText("3 draf");
    await kumpulan.getByRole("button", { name: "Setujui 2" }).click();

    const dialog = page.getByTestId("dialog-draf-massal");
    await expect(dialog).toContainText("Setujui 2 poligon?");
    await expect(dialog.getByTestId("dilewati")).toHaveText('1 dilewati: 1 calon batas kawasan (setujui lewat "Jadikan batas kawasan").');
    await dialog.getByRole("button", { name: "Batal" }).click();
    await expect(dialog).toBeHidden();
    expect(await q("select count(*)::int n from areas where nama like $1 and polygon is not null", [`%Massal ${unik}%`])).toEqual([{ n: 0 }]);

    await kumpulan.getByRole("button", { name: "Setujui 2" }).click();
    await dialog.getByRole("button", { name: "Setujui 2 poligon" }).click();
    await expect(page.getByText(/^2 poligon disetujui dan dipakai gerbang lokasi\. 1 dilewati: 1 calon batas kawasan/)).toBeVisible();

    const rows = await q<{ nama: string; resmi: boolean; draf: boolean }>(
      "select nama, polygon is not null resmi, polygon_draf is not null draf from areas where nama like $1 order by nama",
      [`%Massal ${unik}%`],
    );
    expect(rows).toEqual([
      { nama: nama[0], resmi: true, draf: false },
      { nama: nama[1], resmi: true, draf: false },
      { nama: nama[2], resmi: false, draf: true },
    ]);
    // Yang tersisa di kumpulan: hanya calon kawasan, jadi tidak ada yang bisa disetujui.
    await expect(kumpulan).toContainText("1 draf");
    await expect(kumpulan.getByRole("button", { name: "Setujui 0" })).toBeDisabled();
  } finally {
    await q("update areas set aktif = false where nama like $1", [`%Massal ${unik}%`]);
  }
});
