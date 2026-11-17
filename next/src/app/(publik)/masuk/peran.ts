import type { Role } from "@/lib/domain/constants";

/** Teks animasi deteksi peran di /masuk. */
export const PERAN_MASUK: Record<Role, { peran: string; membuka: string }> = {
    admin: { peran: "Administrator", membuka: "Membuka Panel Admin…" },
    pemantau: { peran: "Pemantau", membuka: "Membuka Papan Pantau…" },
    inspektur: { peran: "Inspektur", membuka: "Membuka Aplikasi Petugas…" },
};

/** Lama tiap fase setelah peladen menjawab (ms). Fase "Memeriksa akun…" = lama autentikasi sebenarnya. */
export const DURASI_TERDETEKSI_MS = 550;
export const DURASI_MEMBUKA_MS = 450;
