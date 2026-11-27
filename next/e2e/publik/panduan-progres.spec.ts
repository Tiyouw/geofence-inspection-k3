import { expect, test } from "@playwright/test";

/**
 * Progres /panduan (20 Nov 2026): pengunjung baru tanpa centang, menahan panah tidak mencentang
 * langkah yang hanya dilewati, dan "Reset progres" menghapus centang lalu kembali ke langkah 1.
 */
test("progres panduan hanya mencentang langkah yang dilihat dan bisa direset", async ({ page }) => {
    await page.addInitScript(() => {
        if (!sessionStorage.getItem("uji-awal")) {
            sessionStorage.setItem("uji-awal", "1");
            // Data v1 lama yang tercentang semua harus dibuang.
            localStorage.setItem("pal-k3-panduan-dikunjungi", JSON.stringify(["pengenalan-kartu-kertas"]));
        }
    });
    await page.goto("/panduan");
    await expect(page.locator(".pd[data-siap]")).toBeAttached();
    const daftar = page.locator(".pd-samping");
    const tercentang = daftar.locator(".pd-cek[data-on]");
    await expect(daftar).toContainText(/^0\/\d+ dilihat/);
    await expect(tercentang).toHaveCount(0);

    // Langkah pertama tercentang setelah tampil sebentar.
    await expect(tercentang).toHaveCount(1);

    // Lompat cepat ke akhir: langkah yang dilewati tidak ikut tercentang.
    for (let n = 0; n < 5; n++) await page.keyboard.press("ArrowRight");
    await page.keyboard.press("End");
    await expect(tercentang).toHaveCount(2);
    await page.waitForTimeout(500);
    await expect(tercentang).toHaveCount(2);

    await daftar.getByRole("button", { name: "Reset progres" }).click();
    const konfirmasi = daftar.getByRole("group", { name: "Konfirmasi reset progres" });
    await konfirmasi.getByRole("button", { name: "Batal" }).click();
    await expect(tercentang).toHaveCount(2);

    await daftar.getByRole("button", { name: "Reset progres" }).click();
    await konfirmasi.getByRole("button", { name: "Ya, reset" }).click();
    await expect(page.locator(".pd-hitung")).toHaveText(/^1\//);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("pal-k3-panduan-dilihat-v2"))).toBeNull();
    // Hanya langkah 1 yang kemudian tercentang lagi setelah dilihat.
    await expect(tercentang).toHaveCount(1);
    await page.reload();
    await expect(page.locator(".pd[data-siap]")).toBeAttached();
    await expect(page.locator(".pd-hitung")).toHaveText(/^1\//);
    await expect(tercentang).toHaveCount(1);
});
