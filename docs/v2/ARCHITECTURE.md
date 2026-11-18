# PAL-K3 v2: Arsitektur dan Aturan Kerja

Fondasi aplikasi v2 ada di `next/` (cabang `rewrite/next`). Aplikasi Laravel tetap di
akar repo sampai cut-over. Apa yang dibangun mengikuti [SPEC.md](SPEC.md); kapan
sebuah fitur dianggap selesai mengikuti [ACCEPTANCE.md](ACCEPTANCE.md).

## 1. Tumpukan

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Kerangka | Next.js 16.4 (App Router), React 19, TypeScript strict | `middleware` sekarang bernama `proxy` (`src/proxy.ts`). Dokumentasi versi terpasang ada di `next/node_modules/next/dist/docs/`; baca itu, bukan ingatan. |
| UI | Tailwind 4 + shadcn/ui (gaya radix-nova, ikon lucide) | Token di `src/app/globals.css` |
| Data | Postgres (Neon lewat Vercel Marketplace) + Drizzle ORM 0.45 | driver `pg` (node-postgres), kolom `snake_case` otomatis (`casing`) |
| Berkas | Vercel Blob **privat** (store `pal-k3-foto`, sin1) | lihat §6 |
| Auth | Auth.js v5 (`next-auth@5 beta`), credentials NIP + sandi bcrypt, sesi JWT | lihat §5 |
| PWA | `src/app/manifest.ts`, `public/sw.js` | antrean luring dibangun sesi Inspektur (SPEC §7) |
| Uji | Vitest (unit), Playwright Chromium (E2E) | CI: `.github/workflows/next.yml` |
| Lokal | pnpm, Node 22 | Postgres lokal lewat Docker, lihat `next/.env.example` |

Bahasa antarmuka Indonesia, zona waktu `Asia/Jakarta`. Waktu disimpan `timestamptz`
(UTC) dan diformat dengan `src/lib/format` (jangan memformat tanggal sendiri).

## 2. Menjalankan

```bash
cd next
cp .env.example .env.local        # isi AUTH_SECRET (openssl rand -base64 32)
docker run -d --name palk3-pg -e POSTGRES_PASSWORD=palk3 -e POSTGRES_USER=palk3 \
  -e POSTGRES_DB=palk3 -p 127.0.0.1:55433:5432 postgres:17-alpine
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev                          # http://localhost:3000
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Akun demo (bila `DEMO_MODE=true`): `admin`/`admin123`, `pemantau`/`pemantau123`,
`inspektur`/`inspektur123`, atau sandi dari `DEMO_*_PASSWORD`. Akun NIP contoh
(1001, 1002, 2001-2005, 3001, 3002) memakai `SEED_SANDI_AWAL`, atau sandi acak yang
dicetak sekali oleh seed.

## 3. Struktur folder dan kepemilikan

Tiga sesi bekerja paralel. **Setiap sesi hanya mengubah folder miliknya.** Berkas
bersama diubah lewat aturan §4.

```
next/
├── drizzle/                     migrasi SQL (dibuat drizzle-kit)          BERSAMA (§4.2)
├── e2e/
│   ├── auth.spec.ts, foto.spec.ts, helpers.ts                             FONDASI
│   ├── petugas/                                                           INSPEKTUR
│   ├── admin/                                                             ADMIN
│   └── pemantau/                                                          LAPORAN
├── public/
│   ├── sw.js                                                              INSPEKTUR
│   └── icons/                                                             FONDASI
└── src/
    ├── app/
    │   ├── (publik)/            /, /masuk, /offline                       FONDASI
    │   ├── api/auth/            Auth.js                                   FONDASI
    │   ├── api/foto/[id]/       penyaji foto privat                       FONDASI
    │   ├── petugas/**           beranda, pindai, riwayat, inspeksi/[id]   INSPEKTUR
    │   ├── i/[token]/           pintasan stiker QR                        INSPEKTUR
    │   ├── api/field/**, api/inspections/**, api/time/   (SPEC §7.11)     INSPEKTUR
    │   ├── admin/**             data induk, tinjauan, pengguna, dasbor    ADMIN
    │   ├── stiker/              lembar stiker QR (admin saja)             ADMIN
    │   ├── pemantau/**          papan pantau, temuan (lihat)              LAPORAN
    │   ├── laporan/**           PMS, rekap temuan, kartu kontrol (PDF)    LAPORAN
    │   └── api/cron/**          pembuatan jadwal awal periode             LAPORAN
    ├── features/
    │   ├── inspeksi/            logika lapangan, antrean luring, kompresi INSPEKTUR
    │   ├── admin/               query & aksi data induk, tinjauan, pencarian ADMIN
    │   └── laporan/             agregasi, PDF, jadwal                     LAPORAN
    ├── components/
    │   ├── ui/                  shadcn/ui                                 BERSAMA (§4.3)
    │   └── shell/               kerangka, merek, menu                     FONDASI (§4.4)
    ├── db/
    │   ├── schema.ts                                                      BERSAMA (§4.2)
    │   ├── index.ts                                                       FONDASI
    │   └── seed/                                                          BERSAMA (§4.2)
    ├── lib/
    │   ├── auth/                config, access, guards                    FONDASI
    │   ├── domain/              konstanta & aturan murni (gerbang GPS...) BERSAMA (§4.5)
    │   ├── storage/photos.ts    penyimpanan foto privat                   FONDASI
    │   └── format/              tanggal, angka (id-ID, WIB)               FONDASI
    └── proxy.ts                                                           FONDASI
```

### 3.1 Pembagian per sesi

| Sesi | Memiliki | Butir ACCEPTANCE |
|---|---|---|
| **Inspektur PWA** | `app/petugas/**`, `app/i/**`, `app/api/{field,inspections,time}/**`, `features/inspeksi/**`, `public/sw.js`, `e2e/petugas/**` | C (sisi pindai), D, E, F1-F4, F6, G1-G9 (finalisasi), N (luring), A6 |
| **Admin** | `app/admin/**`, `app/stiker/**`, `features/admin/**`, `e2e/admin/**` | B (panel), C (ganti token, stiker), H, I, K, F5 (galeri foto di detail inspeksi), 1.2 "Terbitkan sandi baru" |
| **Laporan/Pemantau** | `app/pemantau/**`, `app/laporan/**`, `app/api/cron/**`, `features/laporan/**`, `e2e/pemantau/**` | J, L (PDF; stiker milik Admin), G (jadwal dan cron awal periode), F5 (foto di tampilan pemantau) |
| **Fondasi** (sesi ini) | sisanya | A1-A5, A7, M, O (skrip migrasi data menyusul, belum dikerjakan) |

Fungsi yang dipakai dua sesi (mis. evaluasi gerbang GPS, pembangun kalimat temuan)
ditaruh di `src/lib/domain/` (§4.5), bukan diimpor dari folder `features/` sesi lain.
Mengimpor **baca saja** dari `features/` sesi lain boleh; mengubahnya tidak.

## 4. Berkas bersama: aturan perubahan

### 4.1 Umum
- Satu cabang per sesi dari `rewrite/next` (mis. `rewrite/next-petugas`), PR ke `rewrite/next`.
  Rebase sering; PR kecil.
- Jangan memformat ulang berkas yang bukan milik Anda.

### 4.2 Skema dan migrasi (`src/db/schema.ts`, `drizzle/`, `src/db/seed/`)
- Skema sudah memuat seluruh domain SPEC §2.3. Sebisa mungkin **tidak** diubah.
- Bila harus: perubahan **aditif saja** (kolom/tabel/indeks baru, nullable atau berdefault).
  Jangan mengganti nama atau menghapus kolom tanpa kesepakatan di catatan proyek.
- Migrasi dibuat dengan `pnpm db:generate --name <deskripsi>`; **jangan** menyunting
  migrasi yang sudah di-merge. Dua sesi yang membuat migrasi bersamaan akan bentrok di
  `drizzle/meta/_journal.json`: yang merge belakangan menghapus migrasinya sendiri,
  rebase, lalu menjalankan `db:generate` lagi.
- Seed: tambahkan fungsi baru di `src/db/seed/index.ts` (idempoten), jangan mengubah yang ada.
  Token QR **tidak pernah** ditulis ke berkas seed.

### 4.3 shadcn/ui (`src/components/ui/`)
- Tambah komponen dengan `pnpm dlx shadcn@latest add <nama>`. Bila dua sesi menambah
  komponen yang sama, isi berkasnya identik: ambil salah satu saat konflik.
- Jangan menyunting komponen shadcn untuk kebutuhan satu fitur; bungkus di folder fitur.
  Varian bersama baru (seperti `variant="brand"` pada Button) dibicarakan dulu.

### 4.4 Menu (`src/components/shell/nav.ts`)
- Tiap sesi hanya menambah/mengubah baris di larik miliknya: `NAV_PETUGAS` (Inspektur),
  `NAV_ADMIN` (Admin), `NAV_PEMANTAU` (Laporan). Ikon baru ditambah di `nav-icons.ts`
  (satu baris, urut abjad tidak wajib).

### 4.5 Aturan domain (`src/lib/domain/`)
- Hanya fungsi murni (tanpa DB, tanpa I/O), dengan uji Vitest di `__tests__/`.
- Menambah fungsi atau konstanta: boleh. Mengubah perilaku fungsi yang ada: hanya dengan
  uji yang menunjukkan aturan SPEC yang dirujuk.

## 5. Auth dan peran

| Area | Peran | Lainnya |
|---|---|---|
| `/admin/**`, `/stiker` | admin | dialihkan ke beranda perannya |
| `/pemantau/**`, `/laporan/**` | admin, pemantau | |
| `/petugas/**`, `/i/**` | inspektur | admin/pemantau yang memindai stiker tidak membuat draf |
| `/`, `/masuk`, `/offline` | publik | yang sudah masuk diarahkan ke berandanya |

Peta di atas ada di `src/lib/auth/access.ts` (satu sumber untuk proxy dan server).
**Menambah area baru = menambah baris di `AREA_ACCESS`** (koordinasikan: berkas fondasi).

Tiga lapis, semuanya wajib:
1. `src/proxy.ts`: pemeriksaan optimistis dari JWT (pengalihan cepat).
2. Layout/halaman: `await requireRole("admin")` (mengalihkan bila salah peran).
3. **Setiap** Server Action dan Route Handler yang membaca data terbatas atau menulis:
   `const user = await assertRole("admin")` (melempar `AksesDitolak` 401/403). Proxy dan
   tombol yang disembunyikan tidak dihitung sebagai otorisasi (SPEC §1.4).

`getCurrentUser()` membaca ulang peran dan `aktif` dari DB tiap permintaan, jadi akun
yang dinonaktifkan langsung kehilangan akses walau JWT-nya belum kedaluwarsa.

Masuk: `/masuk` (satu pintu untuk semua peran). Pesan gagal digabung; 5 gagal per
NIP+IP terkunci 60 detik (dicatat di `audit_logs`, tanpa Redis); sesi berakhir setelah
120 menit tidak aktif. Akun demo disimpan dengan hash (`is_demo = true`).

## 6. Foto bukti

- Simpan dan baca **hanya** lewat `src/lib/storage/photos.ts` (`simpanFoto`, `bacaFoto`,
  `hapusFoto`, `kunciFoto`, `sha256Hex`).
- Store Blob privat; URL blob tidak pernah dikirim ke klien. Tampilkan dengan
  `<img src={`/api/foto/${photo.id}`} />`. Rute itu mengizinkan admin dan pemantau untuk
  semua foto dan inspektur hanya untuk inspeksinya sendiri (`bolehLihatFoto`).
- Tanpa `BLOB_READ_WRITE_TOKEN` (lokal/CI) berkas ditulis ke `next/.data/foto/`.
- Batas: `MAKS_FOTO = 6`, `MAKS_BYTE_FOTO = 12 MB` di `src/lib/domain/constants.ts`.

## 7. Konvensi kode

- Bahasa domain Indonesia untuk nama (`inspeksi`, `temuan`, `jatuhTempo`), Inggris untuk
  istilah teknis umum. Nama kolom mengikuti SPEC §2.3.
- Server Component secara bawaan; `"use client"` hanya untuk interaksi. Komponen klien
  tidak menerima fungsi/komponen dari server (contoh: ikon menu dikirim sebagai nama).
- Query DB hanya di kode server (`import "server-only"` di modul query). Validasi masukan
  dengan zod di setiap aksi.
- Nilai domain diambil dari `src/lib/domain/constants.ts`, bukan string lepas.
- Format tanggal/angka lewat `src/lib/format`.
- Warna lewat token semantik (`bg-primary`, `bg-brand`, `text-danger`, `bg-success-soft`, ...),
  bukan hex. Mengganti tampilan = mengubah token di `globals.css`.
- Setiap aksi tulis penting mencatat `audit_logs` (atau `issue_events` untuk temuan).
- Uji: aturan murni di Vitest, alur per peran di Playwright (`e2e/<area>/`). Gunakan akun
  demo dari `e2e/helpers.ts`. Uji yang sengaja gagal masuk memakai NIP acak supaya akun
  demo tidak ikut terkunci.

## 8. Lingkungan dan deploy

- Proyek Vercel `pal-k3` (tim `tiyouws-projects`, Hobby) terhubung ke Git (repo
  `Tiyouw/pal-k3`, Root Directory `next`). Hanya `rewrite/next` yang dibangun, dan cabang itu
  menjadi cabang produksi untuk `dev.geofencinspection.tech`. **Deploy = push ke `rewrite/next`**
  (lewat PR). Jangan `vercel deploy` dari `next/`. `geofencinspection.tech` tetap di tc-vps
  sampai cut-over.
- Basis data: Neon `pal-k3-db` (region sin1, paket Free) lewat integrasi Marketplace,
  tersambung ke Preview dan Production (`DATABASE_URL` pooled, `DATABASE_URL_UNPOOLED` langsung,
  plus variabel `PG*`/`POSTGRES_*` bawaan integrasi).
- Berkas: Blob store `pal-k3-foto` (privat, sin1) → `BLOB_READ_WRITE_TOKEN`.
- Lainnya, diatur dengan `vercel env add` (sensitif, tidak pernah ditulis ke repo):
  `AUTH_SECRET`, `AUTH_TRUST_HOST`, `DEMO_MODE`, opsional `DEMO_*_PASSWORD`.
- Migrasi berjalan **otomatis saat build produksi Vercel** (`prebuild` → `scripts/migrasi-deploy.mjs`,
  `src/db/migrasi-deploy.ts`): migrasi tertunda dijalankan sebelum `next build`. Bila ada pernyataan
  tidak aditif (DROP, RENAME, ubah tipe, SET NOT NULL, TRUNCATE, DELETE), build digagalkan dan versi
  lama tetap melayani; jalankan manual setelah ditinjau. Insiden 18 Nov 2026: migrasi 0003 terlewat,
  /admin/jadwal 500.
- Seed (dan migrasi manual bila build menolak) ke Neon dijalankan dari mesin pengembang:
  `vercel env pull <berkas-sementara> --environment=preview`, muat berkas itu, lalu
  `pnpm db:migrate && DEMO_MODE=true pnpm db:seed`. Variabel sensitif (mis. `DEMO_MODE`,
  `AUTH_SECRET`) tertarik kosong, jadi set manual saat seed. Hapus berkas sementara sesudahnya.

## 9. Keputusan

| # | Keputusan | Alasan |
|---|---|---|
| K-01 | Satu pintu `/masuk` untuk semua peran; admin → `/admin`, pemantau → `/pemantau`, inspektur → `/petugas` | Permintaan pemilik; pintu panel Filament tidak lagi diperlukan |
| K-02 | Sesi JWT, peran dibaca ulang dari DB per permintaan | Credentials provider Auth.js mewajibkan JWT; pembacaan ulang menjaga aturan "nonaktif langsung ditolak" |
| K-03 | `cacheComponents` dimatikan, `typedRoutes` dimatikan | Hampir semua halaman dinamis per pengguna; mengurangi gesekan bagi tiga sesi paralel (tautan ke halaman yang belum ada tetap terketik) |
| K-04 | Driver `pg` (bukan `@neondatabase/serverless`) | Satu driver untuk lokal, CI, dan Neon (URL pooled) |
| K-05 | bcrypt (`bcryptjs`, cost 10) | Murni JS di serverless; hash `$2y$` dari Laravel dapat dimigrasikan {{Unverified}} |
| K-06 | `/stiker` hanya admin | SPEC §9 celah #3; {{Assumption}} menunggu konfirmasi pemilik |
| K-07 | Foto di Blob privat, disajikan rute yang memeriksa sesi | SPEC §3.6, §9 #1-2 |
| K-08 | Pembatas percobaan masuk memakai `audit_logs` | Tanpa layanan tambahan (Redis) di Hobby |
| K-09 | Id integer identity (bukan bigserial) untuk tabel non-perangkat | Setara, gaya Postgres modern; tabel perangkat tetap UUID sesuai SPEC |

## 10. PWA Inspektur (luring)

Implementasi SPEC §3 dan §7. Satu jalur kode untuk daring dan luring: semua isian ditulis
ke IndexedDB dulu, lalu dikirim lewat outbox.

| Bagian | Berkas |
|---|---|
| Aturan bersama (klien + peladen) | `src/lib/domain/inspeksi.ts`: validasi jawaban, severity, kalimat temuan, usulan kesimpulan, `periksaKirim`, waktu resmi, jatuh tempo, tenggat temuan, `ambilToken` |
| IndexedDB per akun `pal-k3:{userId}` | `features/inspeksi/client/db.ts` (store `meta`, `drafts`, `photos`, `outbox`, `sent`); DB global `pal-k3` menyimpan akun aktif untuk service worker |
| Aksi perangkat | `client/aksi.ts`: pindai (cocok HMAC), jawaban, GPS terbaik, foto, kirim, buang, buka kembali, `sinkronJam`, `segarkanPaket` |
| Antrean | `client/outbox.ts`: FIFO per inspeksi, paralel 2, `Idempotency-Key = opId`, backoff 2 s → 5 menit + jitter, `Retry-After`, 401 berhenti, 4xx lain "perlu tindakan" |
| Pemicu | `client/sinkron.ts`: `online`, kembali terlihat, setelah tulis, timer, Background Sync `outbox`; Web Lock `pal-k3-outbox` dibagi dengan SW |
| Service worker | `features/inspeksi/sw/index.ts` → dibundel ke `public/sw.js` oleh `scripts/build-sw.mjs` (otomatis `predev`/`prebuild`; `public/sw.js` tidak di-commit) |
| Peladen | `features/inspeksi/server/`: `bundle.ts` (paket kerja, hash HMAC token dengan kunci acak per unduhan), `inspeksi.ts` (start, foto, finalisasi berkunci, buang), `idempotency.ts` (`sync_receipts`), `http.ts` (401/403 JSON) |
| API | `GET /api/time`, `GET /api/field/bundle`, `POST /api/inspections/start`, `PUT/DELETE /api/inspections/{id}/photos/{photoId}`, `POST /api/inspections/{id}/finalize`, `DELETE /api/inspections/{id}` |
| Halaman | `/petugas` (beranda), `/petugas/pindai[?token=]`, `/petugas/isi?id=` (satu cangkang untuk semua draf), `/petugas/riwayat`, `/i/{token}` |

Catatan:
- Draf dibuat di perangkat (UUIDv7). Operasi `start` membuat baris draf di peladen; draf peladen
  lama milik inspektur yang sama untuk aset yang sama diganti (perangkat sumber kebenaran).
- Peladen tidak menyimpan jawaban sebelum `finalize`; semua aturan §3.7 dijalankan ulang di sana.
- Navigasi antarhalaman lapangan memakai `<a>`/`location.assign` (navigasi penuh), supaya
  service worker bisa melayani salinan halaman saat luring.
- Uji: `src/features/inspeksi/client/__tests__` (Vitest + fake-indexeddb), `e2e/petugas/`
  (Playwright, ponsel). Skenario luring butuh service worker, jadi hanya jalan pada build
  produksi: `pnpm build && pnpm start --port 3200` lalu
  `E2E_BASE_URL=http://localhost:3200 E2E_SW=1 pnpm test:e2e` (CI otomatis).
- Belum: kedaluwarsa draf (SPEC §9 #14), penandaan "waktu perlu dicek" dan "aset nonaktif saat
  diterima" untuk antrean tinjauan (kolomnya ada di sisi Admin), ekspor antrean JSON.
