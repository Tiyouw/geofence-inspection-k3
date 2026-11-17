import { expect, test, type Page } from "@playwright/test";
import { q, tutup } from "../db-uji";
import { masuk } from "../helpers";

/**
 * Jejak audit yang ramah orang awam: kalimat, detail tersembunyi, tanpa gulir mendatar,
 * saringan seketika, dan koordinat tidak pernah tampil.
 */
const tag = `${Date.now().toString(36)}`;
const LAT = "-7.1234567";
const LNG = "112.6543219";
let area: { id: number; nama: string };
let aset: { id: number; label: string };
let adminId: number;

test.beforeAll(async () => {
    [{ id: adminId }] = (await q<{ id: number }>("select id from users where nip = 'admin'")) as [{ id: number }];
    [area] = (await q<{ id: number; nama: string }>(
        "select id, nama from areas where aktif and jenis <> 'kawasan' order by id limit 1",
    )) as [{ id: number; nama: string }];
    [aset] = (await q<{ id: number; label: string }>(
        "select a.id, t.nama || ' ' || a.kode as label from assets a join asset_types t on t.id = a.asset_type_id order by a.id limit 1",
    )) as [{ id: number; label: string }];
    const tulis = (aksi: string, entitas: string | null, entitasId: string | null, data: unknown, umurHari = 0) =>
        q(
            `insert into audit_logs (user_id, aksi, entitas, entitas_id, data, ip, created_at)
             values ($1, $2, $3, $4, $5, '203.0.113.9', now() - ($6 || ' days')::interval)`,
            [adminId, aksi, entitas, entitasId, JSON.stringify(data), String(umurHari)],
        );
    await tulis("area.pasang_aset", "area", String(area.id), { assetIds: [aset.id], uji: tag });
    await tulis("area.ubah", "area", String(area.id), {
        dari: { nama: `Gedung lama ${tag}`, kode: "UJI", jenis: "gedung", divisionId: null, restricted: false },
        ke: { nama: `Gedung baru ${tag}`, kode: "UJI", jenis: "gedung", divisionId: null, restricted: true },
    });
    await tulis("area.setujui", "area", "987654", null);
    await tulis("inspeksi.ditolak_lokasi", "inspection", "0190a1b2-0000-7000-8000-00000000a0d1", {
        assetId: aset.id,
        lat: Number(LAT),
        lng: Number(LNG),
        akurasi: 9,
        jarakKeKawasanM: 777,
    });
    await tulis("pengguna.terbitkan_sandi", "user", "987655", { nip: `lama-${tag}` }, 40);
});

test.afterAll(tutup);

async function tanpaGulirMendatar(page: Page) {
    const [lebar, layar] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(lebar, "halaman tidak boleh lebih lebar dari layar").toBeLessThanOrEqual(layar);
}

test.describe("jejak audit", () => {
    // Server dev mengompilasi halaman saat pertama dibuka; CI memakai build produksi.
    test.slow(!process.env.CI);

    test.beforeEach(async ({ page }) => {
        await masuk(page, "admin");
    });

    test("kalimat sehari-hari, detail tersembunyi, koordinat tidak pernah tampil", async ({ page }) => {
        await page.goto("/admin/audit");
        const jejak = page.getByTestId("jejak-audit");
        await expect(page.getByRole("heading", { level: 2, name: /^Hari ini · / })).toBeVisible();

        const pasang = jejak
            .getByTestId("kejadian")
            .filter({ hasText: `memasangkan 1 aset (${aset.label}) ke ${area.nama}` });
        await expect(pasang.first()).toBeVisible();
        await expect(jejak.getByText(`mengubah nama “Gedung lama ${tag}” menjadi “Gedung baru ${tag}”`)).toBeVisible();
        await expect(jejak.getByText("menyetujui poligon area #987654 (sudah dihapus)").first()).toBeVisible();
        await expect(
            jejak.getByText(`mencoba menginspeksi ${aset.label} dari 777 m di luar kawasan, ditolak`).first(),
        ).toBeVisible();

        // Kunci mentah, JSON, dan IP tersembunyi sampai dibuka.
        await expect(page.getByText("area.pasang_aset").first()).toBeHidden();
        await expect(page.getByText("203.0.113.9").first()).toBeHidden();

        const ubah = jejak.getByTestId("kejadian").filter({ hasText: `Gedung baru ${tag}` });
        await ubah.getByText("Lihat detail").click();
        const tabel = ubah.getByRole("table", { name: "Perubahan" });
        await expect(tabel.getByRole("row", { name: /Area terbatas\s+Tidak\s+Ya/ })).toBeVisible();
        await expect(
            tabel.getByRole("row", { name: new RegExp(`Nama\\s+Gedung lama ${tag}\\s+Gedung baru ${tag}`) }),
        ).toBeVisible();
        await expect(ubah.getByText("area.ubah")).toBeHidden();
        await ubah.getByText("Data teknis").click();
        await expect(ubah.getByText("area.ubah")).toBeVisible();
        await expect(ubah.getByText("203.0.113.9")).toBeVisible();

        const tolak = jejak.getByTestId("kejadian").filter({ hasText: "777 m di luar kawasan" }).first();
        await tolak.getByText("Lihat detail").click();
        await tolak.getByText("Data teknis").click();
        await expect(tolak.getByText(/jarakKeKawasanM/)).toBeVisible();
        const html = await page.content();
        expect(html).not.toContain(LAT.slice(0, 7));
        expect(html).not.toContain(LNG.slice(0, 7));
    });

    for (const [lebar, tinggi] of [
        [360, 780],
        [768, 1024],
        [1280, 800],
    ] as const) {
        test(`tanpa gulir mendatar di lebar ${lebar}px, juga dengan detail terbuka`, async ({ page }) => {
            await page.setViewportSize({ width: lebar, height: tinggi });
            await page.goto("/admin/audit");
            await tanpaGulirMendatar(page);
            const ubah = page.getByTestId("kejadian").filter({ hasText: `Gedung baru ${tag}` });
            await ubah.getByText("Lihat detail").click();
            await ubah.getByText("Data teknis").click();
            await expect(ubah.getByText("203.0.113.9")).toBeVisible();
            await tanpaGulirMendatar(page);
        });
    }

    test("saringan berlaku seketika: jenis kegiatan, pengguna, rentang tanggal", async ({ page }) => {
        await page.goto("/admin/audit");
        await expect(page.getByRole("button", { name: "Terapkan" })).toHaveCount(0);

        await page.getByLabel("Jenis kegiatan").selectOption({ label: "Pengguna" });
        await expect(page).toHaveURL(/kategori=pengguna/);
        await expect(page.getByTestId("kejadian").first()).toBeVisible();
        for (const a of await page
            .getByTestId("kejadian")
            .evaluateAll((els) => els.map((e) => e.getAttribute("data-aksi")))) {
            expect(a).toMatch(/^pengguna\./);
        }
        await expect(page.getByText(`NIP lama-${tag}`).first()).toBeVisible();

        // Rentang tanggal 7 hari terakhir: kejadian 40 hari lalu hilang.
        const hari = (n: number) =>
            new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(Date.now() - n * 86_400_000);
        await page.getByLabel("Dari tanggal").fill(hari(7));
        await expect(page).toHaveURL(new RegExp(`dari=${hari(7)}`));
        await expect(page.getByText(`NIP lama-${tag}`)).toHaveCount(0);

        await page.getByRole("link", { name: "Hapus saringan" }).click();
        await expect(page).toHaveURL(/\/admin\/audit$/);
        await expect(page.getByLabel("Jenis kegiatan")).toHaveValue("");

        await page.getByLabel("Dilakukan oleh").selectOption({ label: "Administrator Demo" });
        await expect(page).toHaveURL(new RegExp(`pengguna=${adminId}`));
        await expect(page.getByTestId("kejadian").filter({ hasText: `Gedung baru ${tag}` })).toBeVisible();
    });
});
