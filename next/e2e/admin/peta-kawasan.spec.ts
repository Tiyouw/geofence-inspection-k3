import { expect, type Locator, type Page, test } from "@playwright/test";
import { masuk } from "../helpers";
import { q, tutup } from "../db-uji";
import { areaTerkecilDi, batasGeometri, type GeometriArea, luasM2, titikTengah } from "../../src/lib/geo/geometri";

/**
 * Peta dibuka pas di kawasan galangan yang disetujui (permintaan pemilik 19 Nov 2026), dan di
 * editor Lokasi kawasan terpilih tidak menelan klik pada gedung di dalamnya; pilihan bisa dilepas.
 * Memakai poligon contoh dari seed (sintetis), bukan denah asli.
 */
test.afterAll(tutup);

type Area = { id: number; nama: string; jenis: string; polygon: GeometriArea };

async function dataKawasan() {
    const rows = await q<Area>(
        "select id, nama, jenis, polygon from areas where aktif and polygon is not null order by id",
    );
    const kawasan = rows.find((r) => r.jenis === "kawasan")!;
    const gedung = rows.filter((r) => r.jenis !== "kawasan");
    return { kawasan, gedung };
}

/** Gedung yang titik tengahnya hanya jatuh di gedung itu sendiri (bukan di gedung lain yang lebih kecil). */
function gedungUji(gedung: Area[], kawasan: Area) {
    for (const g of gedung) {
        const t = titikTengah(g.polygon);
        if (!t) continue;
        const hit = areaTerkecilDi(
            t,
            [...gedung, kawasan].map((a) => ({ id: a.id, geometry: a.polygon })),
            (a) => luasM2(a.geometry),
        );
        if (hit?.id === g.id) return { g, t };
    }
    throw new Error("Tidak ada gedung contoh untuk diklik.");
}

const piksel = (peta: Locator, lat: number, lng: number) =>
    peta.evaluate(
        (el, [la, ln]) => {
            const m = (
                el as HTMLElement & {
                    petaLeaflet: { latLngToContainerPoint: (p: [number, number]) => { x: number; y: number } };
                }
            ).petaLeaflet;
            const p = m.latLngToContainerPoint([la, ln]);
            return { x: p.x, y: p.y };
        },
        [lat, lng] as [number, number],
    );

/** Zoom, zoom minimum, dan apakah kotak kawasan terlihat utuh. */
const keadaanPeta = (peta: Locator, b: [[number, number], [number, number]]) =>
    peta.evaluate((el, bb) => {
        type M = {
            getZoom(): number;
            getMinZoom(): number;
            getBounds(): { contains(b: [[number, number], [number, number]]): boolean };
            getBoundsZoom(b: [[number, number], [number, number]]): number;
            setZoom(z: number, o?: { animate: boolean }): void;
        };
        const m = (el as HTMLElement & { petaLeaflet: M }).petaLeaflet;
        const awal = {
            zoom: m.getZoom(),
            min: m.getMinZoom(),
            muat: m.getBounds().contains(bb),
            pas: m.getBoundsZoom(bb),
        };
        m.setZoom(0, { animate: false });
        return { ...awal, setelahMundur: m.getZoom() };
    }, b);

/** Pasang penunggu "moveend" sebelum aksi yang menggerakkan peta; klik selama animasi diabaikan Leaflet. */
const tungguDiam = async (peta: Locator, aksi: () => Promise<void>) => {
  await peta.evaluate((el) => {
    const m = (el as HTMLElement & { petaLeaflet: { once(e: string, f: () => void): void } }).petaLeaflet;
    (el as HTMLElement & { diam?: Promise<void> }).diam = new Promise<void>((res) => m.once("moveend", () => setTimeout(res, 150)));
  });
  await aksi();
  await peta.evaluate((el) => Promise.race([(el as HTMLElement & { diam: Promise<void> }).diam, new Promise((r) => setTimeout(r, 5000))]));
};

async function klikDi(page: Page, peta: Locator, x: number, y: number) {
    // Jeda > interval klik ganda supaya dua klik di titik sama tidak digabung.
    await page.waitForTimeout(600);
    const kotak = (await peta.boundingBox())!;
    await page.mouse.click(kotak.x + x, kotak.y + y);
}

test("Lokasi: kawasan terpilih tidak menelan klik gedung; lepas pilihan lewat klik ulang, peta kosong, Esc, dan Tutup", async ({
    page,
}) => {
    const { kawasan, gedung } = await dataKawasan();
    const { g, t } = gedungUji(gedung, kawasan);
    await masuk(page, "admin");
    await page.goto("/admin/lokasi");
    const peta = page.getByTestId("peta-area");
    await expect(peta).toHaveAttribute("data-zoom-min", /\d+/);

    // Dibuka pas di kawasan: kawasan terlihat utuh pada zoom yang pas, zoom minimum dua tingkat di bawahnya.
    const k = await keadaanPeta(peta, batasGeometri(kawasan.polygon)!);
    expect(k.muat).toBe(true);
    expect(k.zoom).toBeGreaterThanOrEqual(Math.min(k.pas, 18) - 1);
    expect(k.setelahMundur).toBe(k.min);
    expect(k.min).toBeGreaterThanOrEqual(k.zoom - 2);
    await page.reload();
    await expect(peta).toHaveAttribute("data-zoom-min", /\d+/);

    const daftar = page.getByTestId("daftar-area");
    await page.getByLabel("Cari area").fill(kawasan.nama);
    await tungguDiam(peta, () =>
        daftar
            .getByRole("button", { name: new RegExp(kawasan.nama) })
            .first()
            .click(),
    );
    await expect(peta).toHaveAttribute("data-terpilih", String(kawasan.id));

    // Klik gedung di dalam kawasan terpilih → gedung itu yang terpilih.
    let p = await piksel(peta, t.lat, t.lng);
    await klikDi(page, peta, p.x, p.y);
    await expect(peta).toHaveAttribute("data-terpilih", String(g.id));
    await expect(page.getByTestId("bilah-terpilih")).toContainText(g.nama);

    // Klik gedung yang sama sekali lagi → lepas.
    p = await piksel(peta, t.lat, t.lng);
    await klikDi(page, peta, p.x, p.y);
    await expect(peta).toHaveAttribute("data-terpilih", "");

    // Klik peta kosong (di luar kawasan) → lepas.
    await klikDi(page, peta, p.x, p.y);
    await expect(peta).toHaveAttribute("data-terpilih", String(g.id));
    const [[s, w]] = batasGeometri(kawasan.polygon)!;
    const luar = await piksel(peta, s, w);
    await klikDi(page, peta, Math.max(4, luar.x - 6), Math.min((await peta.boundingBox())!.height - 4, luar.y + 6));
    await expect(peta).toHaveAttribute("data-terpilih", "");

    // Esc → lepas.
    await klikDi(page, peta, p.x, p.y);
    await expect(peta).toHaveAttribute("data-terpilih", String(g.id));
    await page.keyboard.press("Escape");
    await expect(peta).toHaveAttribute("data-terpilih", "");

    // Tombol Tutup yang terlihat → lepas; memilih dari daftar tetap berfungsi.
    await page.getByLabel("Cari area").fill(g.nama);
    await daftar
        .getByRole("button", { name: new RegExp(g.nama) })
        .first()
        .click();
    await expect(peta).toHaveAttribute("data-terpilih", String(g.id));
    await page.getByTestId("bilah-terpilih").getByRole("button", { name: "Tutup" }).click();
    await expect(peta).toHaveAttribute("data-terpilih", "");
});

test("Ringkasan, tinjauan, dan aset: peta dibuka pas di kawasan dan tidak bisa mundur ke tampilan kota", async ({
    page,
}) => {
    const { kawasan } = await dataKawasan();
    const b = batasGeometri(kawasan.polygon)!;
    const [aset] = await q<{ id: number }>("select id from assets where aktif and lat is not null order by id limit 1");
    await masuk(page, "admin");
    for (const url of ["/admin", `/admin/aset/${aset!.id}`]) {
        await page.goto(url);
        const peta = page.locator('[data-testid="peta-leaflet"]').first();
        await expect(peta).toHaveAttribute("data-bingkai-kawasan", "ya");
        await expect(peta).toHaveAttribute("data-zoom-min", /\d+/);
        const k = await keadaanPeta(peta, b);
        expect(k.muat, url).toBe(true);
        expect(k.zoom, url).toBeGreaterThanOrEqual(Math.min(k.pas, 18) - 1);
        expect(k.setelahMundur, url).toBe(k.min);
        expect(k.min, url).toBe(k.zoom - 1);
    }
    const [ins] = await q<{ id: string }>(
        "select id from inspections where status = 'final' and gps_lat is not null order by inspected_at desc limit 1",
    );
    test.skip(!ins, "tidak ada inspeksi final bertitik");
    await page.goto(`/admin/tinjauan/${ins!.id}`);
    const peta = page.locator('[data-testid="peta-leaflet"]').first();
    await expect(peta).toHaveAttribute("data-zoom-min", /\d+/);
    const k = await keadaanPeta(peta, b);
    expect(k.muat).toBe(true);
    expect(k.setelahMundur).toBe(k.min);
});

test.describe("ponsel", () => {
    test.use({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    test("Lokasi di layar ponsel: kartu peta dan tombolnya tidak terpotong", async ({ page }) => {
        await masuk(page, "admin");
        await page.goto("/admin/lokasi");
        const peta = page.getByTestId("peta-area");
        await expect(peta).toBeVisible();
        const lebar = await page.evaluate(() => document.documentElement.clientWidth);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(lebar);
        const kp = (await peta.boundingBox())!;
        expect(kp.x + kp.width).toBeLessThanOrEqual(lebar);
        const impor = (await page.getByRole("button", { name: "Impor GeoJSON" }).boundingBox())!;
        expect(impor.x + impor.width).toBeLessThanOrEqual(lebar);
    });
});
