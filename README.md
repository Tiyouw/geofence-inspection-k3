# geofence-inspection-k3

[![next (v2)](https://github.com/Tiyouw/geofence-inspection-k3/actions/workflows/next.yml/badge.svg?branch=rewrite%2Fnext)](https://github.com/Tiyouw/geofence-inspection-k3/actions/workflows/next.yml)

Sistem inspeksi K3 (keselamatan dan kesehatan kerja) untuk Perusahaan Galangan Kapal. Petugas
memindai stiker QR di aset (APAR, hydrant, kotak P3K, dan lainnya), mengisi daftar periksa dari
ponsel, dan memotret bukti dengan kamera terpandu. Lokasi diperiksa terhadap poligon kawasan dan
gedung. Hasilnya ditinjau Admin K3 dan Pemantau, lalu menjadi laporan.

**Demo:** [dev.geofencinspection.tech](https://dev.geofencinspection.tech)

## Fitur utama

- **Stiker QR per aset.** Formulir inspeksi hanya terbuka setelah stiker aset itu dipindai.
- **Gerbang lokasi poligon.** Posisi dinilai di peladen terhadap poligon kawasan dan gedung yang
  disetujui: *sesuai*, *perlu tinjauan* (di luar area aset atau sinyal lemah), atau *ditolak*
  (di luar galangan). Lokasi wajib aktif.
- **Kamera terpandu.** Foto bukti per langkah, tertaut ke butir daftar periksa. Area terbatas
  tanpa foto.
- **Bekerja luring.** Draf, foto, dan antrean kirim disimpan di perangkat (PWA) dan dikirim
  saat sinyal kembali.
- **Tinjauan dan temuan.** Inspeksi yang perlu tinjauan masuk antrean; butir bermasalah menjadi
  temuan.
- **Laporan PDF**, jadwal inspeksi, peta aset, dan jejak audit yang hanya bisa ditambah.

## Peran

| Peran | Alat | Yang bisa dilakukan |
| --- | --- | --- |
| Inspektur | Ponsel | Pindai QR, isi daftar periksa, foto bukti, lihat riwayat sendiri |
| Admin K3 | Komputer | Kelola aset, area, pengguna, stiker, jadwal; meninjau; laporan; jejak audit |
| Pemantau | Komputer | Papan pantau, tinjauan, dan laporan |

## Struktur repositori

| Folder | Isi |
| --- | --- |
| `next/` | Aplikasi v2 (Next.js 16, Auth.js, Drizzle ORM + Postgres/Neon, Leaflet, Vercel Blob, Ably) |
| `docs/v2/` | Spesifikasi (`SPEC.md`), arsitektur (`ARCHITECTURE.md`), dan uji penerimaan (`ACCEPTANCE.md`) |
| akar repo | Aplikasi v1 (Laravel), dipertahankan sampai cut-over |

## Menjalankan v2 secara lokal

Butuh Node.js 22, pnpm, dan Postgres.

```bash
git clone https://github.com/Tiyouw/geofence-inspection-k3.git
cd geofence-inspection-k3/next
pnpm install

cp .env.example .env.local      # isi DATABASE_URL, AUTH_SECRET, dan lainnya (lihat komentar)
pnpm db:migrate
pnpm db:seed                    # data contoh; sandi awal dari SEED_SANDI_AWAL (kosong = acak)
pnpm dev
```

Buka `http://localhost:3000`. Masuk memakai **NIP**. Dengan `DEMO_MODE=true`, akun demo
`admin`, `pemantau`, dan `inspektur` tersedia (sandinya dari variabel `DEMO_*_PASSWORD`).

Pemeriksaan otomatis:

```bash
pnpm lint && pnpm typecheck
pnpm test          # Vitest (uji *.db.test.ts butuh DATABASE_URL)
pnpm test:e2e      # Playwright (Chromium)
```

## Deploy

Proyek Vercel terhubung ke repositori ini dengan Root Directory `next`. Cabang produksinya
`rewrite/next`: setiap merge ke cabang itu ter-deploy ke dev.geofencinspection.tech, dan migrasi
basis data berjalan saat build. Rincian ada di `docs/v2/ARCHITECTURE.md` §8.

## Data contoh

Repositori ini tidak memuat data asli. Nama petugas pada data contoh adalah nama peran, sandi
dan token QR diterbitkan saat pemasangan, dan denah fasilitas tidak disimpan di repositori.

## Lisensi

MIT. Lihat [LICENSE](LICENSE).
