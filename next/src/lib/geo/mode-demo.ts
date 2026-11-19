/**
 * Mode demo: pengecualian gerbang "di luar galangan" untuk AKUN DEMO.
 *
 * Gunanya: klien (mahasiswa yang tidak berada di galangan) dapat menyelesaikan inspeksi sampai
 * "Terkirim" dengan akun demo dari mana pun. Akun sungguhan TIDAK terpengaruh: tetap ditolak
 * (HTTP 422 `di_luar_kawasan`).
 *
 * Berlaku hanya bila KEDUANYA benar:
 *  a. `users.is_demo = true`, dibaca ulang dari basis data (bukan dari token/sesi);
 *  b. variabel lingkungan `AKUN_DEMO_LEWATI_KAWASAN=1` di peladen.
 *
 * Hanya hasil "ditolak" (jauh di luar kawasan) yang dikecualikan. Hasilnya diterima sebagai
 * `perlu_tinjauan` dengan alasan `mode_demo`, jadi tetap masuk antrean tinjauan Admin/Pemantau
 * dan berlabel jelas. "Diblokir" (lokasi mati / tanpa GPS) tetap diblokir.
 *
 * Mematikan: hapus `AKUN_DEMO_LEWATI_KAWASAN` (atau isi selain "1") dari lingkungan peladen,
 * lalu deploy ulang. Bawaannya mati, jadi produksi aman bila variabel ini tidak diisi.
 */
import type { HasilGerbang } from "./gerbang";

export const ENV_MODE_DEMO = "AKUN_DEMO_LEWATI_KAWASAN";

/** Sakelar lingkungan mode demo; mati kecuali bernilai tepat "1". */
export function modeDemoAktif(env: Record<string, string | undefined> = process.env): boolean {
  return env[ENV_MODE_DEMO] === "1";
}

/** Pengecualian berlaku untuk pengguna ini: akun demo DAN sakelar menyala. */
export function modeDemoBerlaku(isDemo: boolean, env: Record<string, string | undefined> = process.env): boolean {
  return isDemo && modeDemoAktif(env);
}

/**
 * Menerapkan pengecualian pada hasil gerbang. Hasil selain "ditolak" dikembalikan apa adanya;
 * "ditolak" menjadi diterima `perlu_tinjauan` / `mode_demo` bila akun demo dan sakelar menyala.
 */
export function terapkanModeDemo(hasil: HasilGerbang, opsi: { isDemo: boolean; aktif: boolean }): HasilGerbang {
  if (hasil.hasil !== "ditolak" || !opsi.isDemo || !opsi.aktif) return hasil;
  return { ...hasil, hasil: "diterima", status: "perlu_tinjauan", alasan: "mode_demo" };
}
