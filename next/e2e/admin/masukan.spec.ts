import { expect, test } from "@playwright/test";
import { masuk } from "../helpers";

/** Panduan /panduan (publik) → masukan tersimpan → admin membaca dan menandai selesai. */
test("masukan dari panduan sampai ke halaman admin", async ({ page, browser }) => {
    const penanda = `Uji E2E masukan ${Date.now()}`;
    const tamu = await browser.newContext();
    const p = await tamu.newPage();
    await p.goto("/panduan");
    await expect(p.getByRole("heading", { level: 1 })).toContainText("Coba PAL-K3 v2");
    await expect(p.locator(".pd[data-siap]")).toBeAttached();
    await p.keyboard.press("ArrowRight");
    await expect(p.getByRole("heading", { level: 1 })).toContainText("Kartu kertas");
    await expect(p).toHaveURL(/#pengenalan-kartu-kertas/);

    await p.getByRole("button", { name: "Masukan" }).click();
    const panel = p.getByRole("dialog", { name: "Kirim masukan" });
    await expect(panel).toContainText("Langkah 2 · Pengenalan");
    await panel.getByRole("button", { name: "Kirim" }).click();
    await expect(panel.getByRole("alert")).toContainText("Pilih jenisnya");
    await panel.getByRole("radio", { name: "Saran" }).check();
    await panel.getByRole("textbox", { name: "Ceritakan" }).fill(penanda);
    await panel.getByRole("button", { name: "Kirim" }).click();
    await expect(panel.getByRole("status")).toContainText("Terkirim");
    await tamu.close();

    // Tanpa callbackUrl: helper memeriksa URL tidak lagi memuat "/masuk", yang juga cocok dengan "/admin/masukan".
    await masuk(page, "admin");
    await page.goto("/admin/masukan");
    const kartu = page.getByTestId("daftar-masukan").locator("li", { hasText: penanda });
    await expect(kartu).toContainText("Saran");
    await expect(kartu).toContainText("Faldy");
    await kartu.getByRole("button", { name: "Tandai selesai" }).click();
    await expect(page.getByTestId("daftar-masukan").locator("li", { hasText: penanda })).toHaveCount(0);
    await page.goto("/admin/masukan?semua=1");
    await expect(page.locator("li", { hasText: penanda })).toContainText("Selesai");
});

test("API masukan menolak isian tidak sah", async ({ request }) => {
    const r = await request.post("/api/masukan", { multipart: { nama: "x", jenis: "spam", isi: "halo semua" } });
    expect(r.status()).toBe(422);
});
