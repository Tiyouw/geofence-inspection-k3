# Geofence Inspection K3 v2: Spesifikasi Fungsional Aplikasi Saat Ini

Dokumen ini memotret perilaku aplikasi Laravel + Filament yang **sekarang** berjalan
(geofencinspection.tech), supaya penulisan ulang ke Next.js + TypeScript (cabang
`rewrite/next`) tidak kehilangan satu aturan pun. Setiap aturan diberi rujukan
`berkas:baris` ke kode Laravel pada commit `00907a4` (main, 16 Nov 2026).

Konvensi penandaan:

- **[ATURAN]** perilaku yang wajib dipertahankan di v2.
- **[CELAH]** perilaku saat ini yang keliru, tidak konsisten, atau belum ada. v2
  sebaiknya memperbaikinya; keputusan akhir ada di pemilik.
- {{Asumsi}} dugaan yang belum dipastikan; {{Belum diverifikasi}} hal yang tidak
  bisa dicek dari kode (mis. isi basis data live).

Daftar uji penerimaan turunan dokumen ini ada di [ACCEPTANCE.md](ACCEPTANCE.md).
Contoh PDF yang dirender dari data seed ada di [samples/](samples/).

---

## Daftar isi

1. [Peran, hak akses, dan cara masuk](#1-peran-hak-akses-dan-cara-masuk)
2. [Model data](#2-model-data)
3. [Alur inspeksi lapangan](#3-alur-inspeksi-lapangan)
4. [Fitur administrasi](#4-fitur-administrasi)
5. [Tampilan Pemantau](#5-tampilan-pemantau)
6. [Non-fungsional](#6-non-fungsional)
7. [Rancangan offline untuk v2](#7-rancangan-offline-untuk-v2)
8. [Rencana migrasi data](#8-rencana-migrasi-data)
9. [Lampiran: daftar celah yang ditemukan](#9-lampiran-daftar-celah-yang-ditemukan)

---

## 1. Peran, hak akses, dan cara masuk

### 1.1 Tiga peran

Kolom `users.role` berupa string (`database/migrations/2026_09_26_100005_ubah_role_users_jadi_string.php:30`).
Konstanta di `app/Models/User.php:26-45`:

| Nilai `role` | Label | Alat kerja | Boleh panel `/admin` |
|---|---|---|---|
| `admin` | Administrator K3 | Komputer | Ya |
| `pemantau` | Pemantau | Komputer | Ya, hanya baca |
| `inspektur` | Inspektur | Ponsel | **Tidak** |

- [ATURAN] Nilai lama `supervisor` dipetakan ke `pemantau` (migrasi `..._100005:27`).
- [ATURAN] Akun `aktif = false` tidak bisa masuk dari pintu mana pun:
  `Auth::attempt([... 'aktif' => true])` (`app/Http/Controllers/Petugas/AuthController.php:57-60`),
  `Masuk::getCredentialsFromFormData` (`app/Filament/Auth/Masuk.php:19-22`),
  `canAccessPanel` (`User.php:62-65`), middleware `inspektur` (`app/Http/Middleware/PastikanInspektur.php:24-26`),
  middleware `pengelola` (`app/Http/Middleware/PastikanPengelola.php:24`).
- [ATURAN] Petugas tidak pernah dihapus, hanya dinonaktifkan, supaya riwayat
  inspeksi tetap terikat (`app/Filament/Resources/UserResource.php:38-46`;
  uji `UserManagementTest::test_petugas_dinonaktifkan_sebagai_pengganti_hapus_agar_riwayat_tetap_ada`).

### 1.2 Cara masuk

Identitas login adalah kolom `users.nip` (string ≤ 32, unik, `..._100010_add_role_to_users_table.php:13`).
Surel tetap disimpan (wajib, unik) tetapi **tidak** dipakai untuk masuk.

| Pintu | Rute | Untuk | Perilaku |
|---|---|---|---|
| Pintu petugas | `GET/POST /masuk` (`routes/web.php:27-30`) | Semua peran | Field `nip` + `password` + `ingat` (remember me). Inspektur → `petugas.beranda`; admin/pemantau → `redirect()->intended('/admin')` (`AuthController.php:77-82`). Hanya untuk tamu (middleware `guest`); pengguna yang sudah masuk dialihkan ke beranda petugas (`AuthController.php:30-32`). |
| Pintu panel | `GET /admin/login` (Filament, `app/Providers/Filament/AdminPanelProvider.php:35`) | Admin, pemantau | Halaman `Masuk` menimpa field surel menjadi `nip` (`Masuk.php:14-17`). Inspektur yang berhasil autentikasi ditolak 403 oleh `canAccessPanel` (uji `RedesainPanelTest::test_login_panel_memakai_nip_dan_menolak_peran_inspektur_atau_nonaktif`). |
| Keluar | `POST /keluar` (`routes/web.php:32-34`) | Semua | Logout, invalidasi sesi, regenerasi token CSRF, kembali ke `/masuk` dengan pesan "Anda sudah keluar." (`AuthController.php:85-92`). |

- [ATURAN] Pesan gagal disatukan supaya tidak membocorkan apakah NIP terdaftar:
  "NIP atau kata sandi tidak cocok, atau akun sudah tidak aktif." (`AuthController.php:66-68`);
  di panel: "NIP atau kata sandi tidak cocok, atau akun tidak memiliki akses panel." (`Masuk.php:26`).
- [ATURAN] Label field panel: "NIP" saat demo mati, "NIP atau username" saat demo hidup (`Masuk.php:16`).
- [ATURAN] Tamu yang membuka rute berpelindung `auth` diarahkan ke `/masuk`, bukan `/login`
  (`bootstrap/app.php:22`). Pemindaian stiker oleh tamu → `/masuk` → setelah masuk kembali ke `/i/{token}` (intended URL).
- [ATURAN] Kata sandi tidak pernah ada di repo. Akun NIP mendapat sandi lewat perintah
  `php artisan petugas:sandi {nip}` / `--semua` (sandi acak 14 karakter tanpa simbol,
  tampil sekali; `--sandi` ditolak bersama `--semua`) (`app/Console/Commands/SandiPetugas.php:29-95`).
  v2 butuh padanan: aksi admin "Terbitkan sandi baru" yang menampilkan sandi sekali.

### 1.3 Mode demo

Konfigurasi `config/demo.php:1-26`, aktif bila `DEMO_MODE=true`.

- Tiga akun dengan `nip` berupa **username**: `admin`, `pemantau`, `inspektur`
  (sandi bawaan `admin123`, `pemantau123`, `inspektur123`, dapat ditimpa env
  `DEMO_*_PASSWORD`), divisi K3LH / TI / PIP.
- [ATURAN] Sandi akun demo disimpan **apa adanya** (tidak di-hash) selama demo aktif:
  mutator `password` melewati hash untuk akun demo (`User.php:72-85`); provider
  `demo-aware` membandingkan dengan `hash_equals` hanya bila akun adalah akun demo dan
  demo aktif (`app/Auth/DemoUserProvider.php:12-27`, terdaftar di `app/Providers/AppServiceProvider.php:27`, dipakai `config/auth.php:66`).
- [ATURAN] Demo dimatikan → sandi teks biasa ditolak dan petunjuk kredensial hilang dari halaman masuk
  (uji `DemoLoginTest::test_mematikan_demo_menolak_sandi_teks_biasa_dan_menyembunyikan_petunjuk`).
- [ATURAN] Akun NIP biasa tetap memakai hash walau demo aktif (`DemoLoginTest::test_akun_nip_tetap_bisa_login_dengan_hash_saat_demo_aktif`).
- [ATURAN] `DemoUserSeeder` idempoten, hanya mengatur ulang tiga akun demo, tidak
  menyentuh akun NIP, inspeksi, atau token QR; tidak melakukan apa pun saat demo mati
  (`database/seeders/DemoUserSeeder.php`; uji `test_seeder_demo_idempoten_dan_tidak_mengganti_akun_nip`, `test_seeder_demo_tidak_membuat_akun_saat_nonaktif`).
- Halaman masuk (`/masuk` dan `/admin/login`) menampilkan kotak kredensial demo hanya saat demo aktif.

**Rekomendasi v2:** pertahankan perilaku, tetapi simpan hash juga untuk akun demo
(seed dengan sandi dari env) dan tampilkan kredensial dari env. Perbedaan perilaku
tidak terlihat oleh pengguna dan menghapus jalur "sandi teks biasa" dari kode.

### 1.4 Matriks hak akses

Legenda: ✅ boleh · 👁 hanya lihat · ❌ ditolak (403) · ↪ dialihkan.

#### Rute di luar panel

| Rute | Tamu | Inspektur | Admin | Pemantau | Rujukan |
|---|---|---|---|---|---|
| `GET /` landing | ✅ | ✅ (tautan "Buka aplikasi" → `/petugas`) | ✅ (→ `/admin`) | ✅ (→ `/admin`) | `routes/web.php:19`, `ExampleTest::pengguna_masuk_melihat_tautan_ke_aplikasinya` |
| `GET/POST /masuk` | ✅ | ↪ (middleware `guest`) | ↪ (middleware `guest`) | sama | `routes/web.php:27-30`; tujuan pengalihan bawaan Laravel {{Belum diverifikasi}}, v2: inspektur → `/petugas`, lainnya → `/admin` |
| `GET /i/{token}` | ↪ `/masuk` | ✅ buat/lanjutkan draf | ↪ `/admin` (tanpa membuat draf) | ↪ `/admin` | `routes/web.php:51-53`, `AlurLapanganTest::akun_panel_tidak_membuat_draf_saat_membuka_qr` |
| `GET /petugas` beranda, `/petugas/riwayat`, `/petugas/pindai` | ↪ `/masuk` | ✅ | ↪ `/admin` | ↪ `/admin` | `routes/web.php:64-67`, `PastikanInspektur.php:28-38` |
| `/petugas/inspeksi/{id}/...` (isi, lokasi, jawaban, foto, hapus foto, kirim, batal, selesai) | ↪ `/masuk` | ✅ **hanya draf miliknya** (selain itu 403 "Inspeksi ini bukan milik Anda.") | ↪ `/admin`; permintaan JSON → 403 | sama | `routes/web.php:69-78`, `app/Http/Controllers/Petugas/InspeksiController.php:447-450`, `PastikanInspektur.php:31-33` |
| `GET /stiker` | ↪ `/masuk` | ❌ 403 "Halaman ini hanya untuk Admin K3 dan Pemantau K3LH." | ✅ | ✅ | `routes/web.php:93-94`, `PastikanPengelola.php:24-25` |
| `GET /laporan`, `/laporan/pms`, `/laporan/temuan`, `/laporan/kartu/{asset}` | ↪ `/masuk` | ❌ 403 | ✅ | ✅ | `routes/web.php:96-101` |
| `GET /up` health | ✅ | ✅ | ✅ | ✅ | `bootstrap/app.php:12` |
| URL tak dikenal | 404 ID + tautan masuk | 404 + tautan beranda/pemindai | 404 + tautan panel | sama | `routes/web.php:119-121`, `HalamanGalatTest` |

[CELAH] Pemantau dapat membuka `/stiker` dan melihat token QR semua aset (dicetak di
bawah QR, `resources/views/stiker/lembar.blade.php:194`). Hal ini bertentangan dengan
alasan penjagaan yang ditulis di `PastikanPengelola.php:13-16` ("siapa pun yang dapat
mencetak stiker dapat memindai kodenya dari mana saja"). v2: batasi `/stiker` ke admin,
atau putuskan bersama pemilik.

#### Panel `/admin` (Filament)

Sumber aturan: trait `HanyaAdminBolehMenulis` (`app/Filament/Concerns/HanyaAdminBolehMenulis.php:18-73`)
dipakai semua Resource; menu grup "Data Induk" disembunyikan dari selain admin (`:25-28`).

| Halaman / aksi | Admin | Pemantau | Rujukan |
|---|---|---|---|
| Dasbor | ✅ antrean keputusan + aksi | 👁 ringkasan manajemen, tanpa antrean dan aksi | `app/Filament/Pages/Dasbor.php:47-66` |
| Dasbor: Tinjau posisi / Tetapkan tenggat / Tandai selesai | ✅ | ❌ (`authorize` + `abort_unless`) | `Dasbor.php:68-111`, `RedesainPanelTest::test_pemantau_tidak_bisa_memanggil_aksi_tulis_langsung` |
| Inspeksi: daftar, lihat | ✅ | 👁 | `app/Filament/Resources/InspectionResource.php` |
| Inspeksi: buat | ❌ (bahkan admin) | ❌ | `InspectionResource.php:75-79` |
| Inspeksi: ubah (hanya `catatan_review`) | ✅ | ❌ | `InspectionResource.php:81-114` |
| Inspeksi: aksi "Tandai ditinjau" | ✅ | ❌ (tersembunyi) | `InspectionResource.php:230-258` |
| Temuan: daftar | ✅ | 👁 | `app/Filament/Resources/IssueResource.php` |
| Temuan: buat/ubah/hapus massal | ✅ | ❌ | trait |
| Aset, Tipe Objek, Divisi, Grup Checklist, Butir Checklist: daftar | ✅ | 👁 bila URL diketik (menu tersembunyi) | trait `:25-28`, `OtorisasiPanelTest::test_pemantau_masih_boleh_melihat_daftar_aset` |
| ...: buat/ubah/hapus | ✅ | ❌ | `OtorisasiPanelTest::test_pemantau_tidak_boleh_menulis_di_semua_resource` |
| Aset: aksi "Ganti token" | ✅ | ❌ (tersembunyi) | `app/Filament/Resources/AssetResource.php:259-279` |
| Petugas (Users): semua | ✅ (tanpa hapus) | ❌ 403 | `UserResource.php:33-46` |
| Petugas: ubah peran / nonaktifkan diri sendiri | ❌ (field dinonaktifkan) | ❌ | `UserResource.php:55-56,65-66` |
| Pencarian Ctrl+K | ✅ penuh | terbatas (lihat §4.6) | `app/Filament/Pencarian/PencarianPanel.php` |
| Menu "Lembar Stiker QR", "Laporan Bulanan" | ✅ | ✅ | `AdminPanelProvider.php:86-100` |

[ATURAN] Kewenangan dijaga di sisi server untuk setiap aksi, bukan hanya dengan
menyembunyikan tombol (catatan di `Dasbor.php:77-80`; `plan.md` Tahap 1).

---

## 2. Model data

### 2.1 Tabel dan kolom saat ini (SQLite)

Hasil akhir setelah seluruh migrasi `database/migrations/` dijalankan. Semua tabel
memiliki `id` bigint autoincrement dan `created_at`/`updated_at` kecuali disebut lain.

#### `users`
| Kolom | Tipe | Aturan | Sumber |
|---|---|---|---|
| name | string | wajib | `0001_01_01_000000:16` |
| nip | string(32) | nullable, **unik**; berisi NIP atau username demo | `..._100010:13` |
| email | string | wajib, unik (tidak dipakai login) | `0001_..._000000:17` |
| email_verified_at | timestamp? | tidak dipakai | |
| password | string | hash bcrypt; teks biasa hanya untuk akun demo | `User.php:78-85` |
| role | string(32) | default `inspektur`; nilai sah `admin`/`pemantau`/`inspektur` | `..._100005:30` |
| jabatan | string? | | `..._100010:20` |
| division_id | FK divisions? | `nullOnDelete` | `..._100008:30-31` |
| aktif | bool | default true | `..._100010:21` |
| remember_token | string? | | |

Tabel pendukung Laravel: `password_reset_tokens` (tidak dipakai), `sessions` (driver
sesi database), `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`. Tidak perlu dimigrasikan.

#### `divisions`
`nama` string, `kode` string? (K3LH, TI, PIP), `aktif` bool (`..._100001`). Relasi: hasMany assets (`Division.php:17-20`), hasMany users (implisit).

#### `asset_types`
| Kolom | Tipe | Catatan |
|---|---|---|
| slug | string unik | `apar`, `hydrant`, `p3k`, `damkar` |
| nama | string | APAR, Hydrant, Kotak P3K, Mobil Pemadam |
| is_mobile | bool | hanya `damkar` = true |
| periode_hari | smallint, default 30 | APAR 30 (NFPA 10), damkar 7 |
| urut | smallint | |
| aktif | bool | |

Seed: `database/seeders/MasterSeeder.php:39-44`. Hanya APAR yang punya checklist; modul
lain tampil di landing sebagai "belum siap" (`app/Http/Controllers/LandingController.php:43`: `siap = aktif && punya grup checklist`).

#### `assets`
| Kolom | Tipe | Catatan |
|---|---|---|
| asset_type_id | FK, `restrictOnDelete` | |
| division_id | FK?, `nullOnDelete` | penanggung jawab laporan |
| kode | string | nomor tabung (mis. `01D`); **unik per tipe** `(asset_type_id, kode)` |
| gedung | string? | |
| lantai | string? | bisa sudah berawalan "Lt. 1", atau "-" untuk tanpa lantai |
| lokasi_teks | string | wajib |
| lokasi_tipe | string, default `dalam_gedung` | `dalam_gedung`/`bengkel`/`area_terbuka`/`kendaraan` (`..._100003:22`) |
| lat, lng | decimal(10,7)? | |
| radius_m | smallint? | override; null = ikut `lokasi_tipe` |
| qr_token | string(64) **unik** | `PAL-K3-` + 32 hex acak (v2: `GIK3-`, ADR-17) |
| attributes | json? | `{tipe, kapasitas_kg, jenis?}` |
| tgl_expired | date? | |
| terakhir_dicek | date? | diisi otomatis saat inspeksi final |
| aktif | bool | |

Indeks: `(asset_type_id, aktif)`, `lokasi_tipe`. Relasi: `inspections` diurutkan
`inspected_at desc` (`app/Models/Asset.php:79-82`), `issues`.

#### `checklist_groups`
`asset_type_id` FK `cascadeOnDelete`, `kode` string(8)? (A–D), `nama`, `urut`. Indeks `(asset_type_id, urut)`.

#### `checklist_items`
| Kolom | Tipe | Catatan |
|---|---|---|
| checklist_group_id | FK `cascadeOnDelete` | |
| label | string | |
| answer_type | string(16), default `kondisi` | `fungsi`, `kondisi`, `boolean`, `select`, `number`, `date`, `text` (`app/Models/ChecklistItem.php:15-23`) |
| options | json? | daftar pilihan untuk `select` |
| jumlah_baku | smallint? | acuan untuk `number` (kotak P3K) |
| satuan | string(24)? | |
| dasar_hukum | string? | rujukan regulasi |
| keterangan | text? | |
| severity_default | enum `ringan`/`sedang`/`berat`, default `sedang` | |
| severity_map | json? | `{pilihan: severity}` untuk `select` |
| wajib | bool | |
| urut | smallint | **kunci stabil** item (seed dikunci pada `(group, urut)`, `MasterSeeder.php:159-169`) |
| aktif | bool | item lama yang sudah punya jawaban dinonaktifkan, bukan dihapus (`MasterSeeder.php:194-211`) |

#### `inspections`
| Kolom | Tipe | Catatan |
|---|---|---|
| asset_id | FK `restrictOnDelete` | |
| user_id | FK `restrictOnDelete` | penanggung jawab di laporan resmi |
| status | string(16) | `draf` → `final` (lihat [CELAH] di bawah) |
| inspected_at | timestamp? | **waktu peladen saat kirim**; null selama draf (`..._100007_jadikan_inspected_at_nullable`) |
| mulai_pada | timestamp? | waktu peladen saat draf dibuat (pindai QR) |
| durasi_detik | int? | `inspected_at − mulai_pada` |
| device_time | timestamp? | jam ponsel saat menekan Kirim, hanya pembanding |
| ua | string(255)? | user agent saat pindai |
| gps_lat, gps_lng | decimal(10,7)? | |
| gps_accuracy | smallint? | meter, dibulatkan |
| jarak_m | int? | ke titik aset |
| qr_verified | bool | true bila lahir dari `/i/{token}` |
| gate_status | string(32), default `tanpa_gps` | `sesuai`/`perlu_review`/`jauh`/`gps_lemah`/`tanpa_gps`/`tidak_berlaku` |
| kesimpulan | string? | `layak`/`layak_catatan`/`tidak_layak` |
| catatan | text? | catatan umum inspektur |
| rekomendasi | text? | wajib bila ada temuan |
| ditinjau_pada | timestamp? | tinjauan admin |
| ditinjau_oleh | FK users? `nullOnDelete` | |
| catatan_review | text? | alasan tinjauan, ≥ 10 karakter |

Indeks: `(asset_id, inspected_at)`, `(inspected_at, gate_status)`, `(gate_status, inspected_at)`.

- [CELAH] Migrasi awal memberi default `status = 'draft'` (`..._100006:35`), tetapi kode
  memakai `draf` (`InspeksiController.php:88`, `BerandaController.php:50`). Default kolom
  tidak pernah terpakai karena status selalu diisi eksplisit. v2: enum tunggal `draf | final`.
- [CELAH] Tidak ada batasan basis data "satu draf per (aset, inspektur)"; dijaga hanya oleh
  `firstOrCreate` (`InspeksiController.php:84-95`). v2: indeks unik parsial.

#### `inspection_answers`
`inspection_id` FK `cascadeOnDelete`, `checklist_item_id` FK `restrictOnDelete`,
`nilai` string(32)?, `nilai_angka` int?, `catatan` text?. Unik `(inspection_id, checklist_item_id)`.

- Nilai dua-pilihan: `ok` / `tidak`. `select`: teks pilihan persis. `number`: di `nilai_angka`.

[CELAH] Kolom `nilai` hanya 32 karakter, sedangkan validasi menerima ≤ 120
(`InspeksiController.php:192`). SQLite tidak memotong, Postgres akan menolak. v2: `text`.

#### `inspection_photos`
`inspection_id` FK `cascadeOnDelete`, `path` string (relatif ke disk `public`:
`inspeksi/{inspection_id}/{uuid}.jpg`), `taken_at` timestamp? (**waktu unggah di peladen**),
`lat`, `lng` (salinan GPS inspeksi saat unggah), `bytes` int?. Berkas fisik ikut terhapus
saat baris dihapus (`app/Models/InspectionPhoto.php:52-57`).

#### `issues` (temuan)
| Kolom | Tipe | Catatan |
|---|---|---|
| asset_id | FK `cascadeOnDelete` | |
| inspection_id | FK? `nullOnDelete` | |
| checklist_item_id | FK? `nullOnDelete` | |
| item | string | kalimat temuan siap baca |
| severity | enum `ringan`/`sedang`/`berat` | |
| status | enum `terbuka`/`proses`/`selesai` | |
| tindak_lanjut | text? | |
| target_selesai | date? | tenggat |
| selesai_pada | timestamp? | |

Indeks `(asset_id, status)`, `(status, severity)`.

#### `schedules` (jadwal kewajiban)
`asset_id` FK `cascadeOnDelete`, `periode` date (tanggal 1 bulan), `jatuh_tempo` date,
`inspection_id` FK? `nullOnDelete`, `status` string `belum`/`selesai`/`telat`.
Unik `(asset_id, periode)`, indeks `(periode, status)`.

### 2.2 Relasi ringkas

```
divisions 1─* users          divisions 1─* assets
asset_types 1─* assets       asset_types 1─* checklist_groups 1─* checklist_items
assets 1─* inspections *─1 users (inspektur)     inspections *─1 users (ditinjau_oleh)
inspections 1─* inspection_answers *─1 checklist_items
inspections 1─* inspection_photos
assets 1─* issues *─? inspections, issues *─? checklist_items
assets 1─* schedules *─? inspections
```

### 2.3 Usulan skema Postgres v2 (sketsa Drizzle)

Perubahan utama: enum nyata, UUID untuk entitas yang bisa lahir di perangkat
(inspeksi, jawaban, foto) supaya pembuatan offline tidak butuh id dari peladen,
`client_id`/idempotency key, kolom waktu perangkat terpisah dari waktu peladen,
penyimpanan foto di object storage, dan jejak audit temuan.

```ts
import { pgTable, pgEnum, bigserial, uuid, text, varchar, boolean, smallint, integer,
  numeric, date, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const role = pgEnum('role', ['admin', 'pemantau', 'inspektur']);
export const lokasiTipe = pgEnum('lokasi_tipe', ['dalam_gedung', 'bengkel', 'area_terbuka', 'kendaraan']);
export const answerType = pgEnum('answer_type', ['fungsi', 'kondisi', 'boolean', 'select', 'number', 'date', 'text']);
export const severity = pgEnum('severity', ['ringan', 'sedang', 'berat']);
export const inspectionStatus = pgEnum('inspection_status', ['draf', 'final']);
export const gateStatus = pgEnum('gate_status', ['sesuai', 'perlu_review', 'jauh', 'gps_lemah', 'tanpa_gps', 'tidak_berlaku']);
export const kesimpulan = pgEnum('kesimpulan', ['layak', 'layak_catatan', 'tidak_layak']);
export const issueStatus = pgEnum('issue_status', ['terbuka', 'proses', 'selesai']);
export const scheduleStatus = pgEnum('schedule_status', ['belum', 'selesai', 'telat']);

const ts = () => ({
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const divisions = pgTable('divisions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  nama: text('nama').notNull(),
  kode: varchar('kode', { length: 16 }).unique(),
  aktif: boolean('aktif').default(true).notNull(),
  ...ts(),
});

export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  nip: varchar('nip', { length: 32 }).notNull().unique(),      // NIP atau username demo
  name: text('name').notNull(),
  email: text('email').unique(),                                 // tidak dipakai login
  passwordHash: text('password_hash').notNull(),                 // selalu hash (argon2id/bcrypt)
  role: role('role').default('inspektur').notNull(),
  jabatan: text('jabatan'),
  divisionId: integer('division_id').references(() => divisions.id, { onDelete: 'set null' }),
  aktif: boolean('aktif').default(true).notNull(),
  isDemo: boolean('is_demo').default(false).notNull(),
  ...ts(),
});

export const assetTypes = pgTable('asset_types', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  slug: varchar('slug', { length: 32 }).notNull().unique(),
  nama: text('nama').notNull(),
  isMobile: boolean('is_mobile').default(false).notNull(),
  periodeHari: smallint('periode_hari').default(30).notNull(),
  urut: smallint('urut').default(0).notNull(),
  aktif: boolean('aktif').default(true).notNull(),
  ...ts(),
});

export const assets = pgTable('assets', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  assetTypeId: integer('asset_type_id').notNull().references(() => assetTypes.id, { onDelete: 'restrict' }),
  divisionId: integer('division_id').references(() => divisions.id, { onDelete: 'set null' }),
  kode: varchar('kode', { length: 32 }).notNull(),
  gedung: varchar('gedung', { length: 64 }),
  lantai: varchar('lantai', { length: 16 }),
  lokasiTeks: text('lokasi_teks').notNull(),
  lokasiTipe: lokasiTipe('lokasi_tipe').default('dalam_gedung').notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  radiusM: smallint('radius_m'),                                 // override 5..500
  qrToken: varchar('qr_token', { length: 64 }).notNull().unique(),
  qrTokenRotatedAt: timestamp('qr_token_rotated_at', { withTimezone: true }),
  attributes: jsonb('attributes').$type<{ tipe?: string; jenis?: string; kapasitas_kg?: number } & Record<string, unknown>>(),
  tglExpired: date('tgl_expired'),
  terakhirDicek: date('terakhir_dicek'),
  aktif: boolean('aktif').default(true).notNull(),
  ...ts(),
}, (t) => [
  uniqueIndex('assets_type_kode').on(t.assetTypeId, t.kode),
  index('assets_type_aktif').on(t.assetTypeId, t.aktif),
]);

export const checklistGroups = pgTable('checklist_groups', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  assetTypeId: integer('asset_type_id').notNull().references(() => assetTypes.id, { onDelete: 'cascade' }),
  kode: varchar('kode', { length: 8 }),
  nama: text('nama').notNull(),
  urut: smallint('urut').default(0).notNull(),
  ...ts(),
});

export const checklistItems = pgTable('checklist_items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  checklistGroupId: integer('checklist_group_id').notNull().references(() => checklistGroups.id, { onDelete: 'restrict' }),
  label: text('label').notNull(),
  answerType: answerType('answer_type').default('kondisi').notNull(),
  options: jsonb('options').$type<string[]>(),
  severityMap: jsonb('severity_map').$type<Record<string, 'ringan' | 'sedang' | 'berat'>>(),
  severityDefault: severity('severity_default').default('sedang').notNull(),
  jumlahBaku: smallint('jumlah_baku'),
  satuan: varchar('satuan', { length: 24 }),
  dasarHukum: text('dasar_hukum'),
  keterangan: text('keterangan'),
  wajib: boolean('wajib').default(true).notNull(),
  urut: smallint('urut').default(0).notNull(),
  aktif: boolean('aktif').default(true).notNull(),
  ...ts(),
}, (t) => [uniqueIndex('items_group_urut').on(t.checklistGroupId, t.urut)]);

export const inspections = pgTable('inspections', {
  id: uuid('id').primaryKey(),                                   // dibuat di perangkat (UUIDv7)
  legacyId: integer('legacy_id').unique(),                       // id Laravel lama
  assetId: integer('asset_id').notNull().references(() => assets.id, { onDelete: 'restrict' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  status: inspectionStatus('status').default('draf').notNull(),
  // waktu
  scannedAtDevice: timestamp('scanned_at_device', { withTimezone: true }),   // pindai QR, jam perangkat
  submittedAtDevice: timestamp('submitted_at_device', { withTimezone: true }), // tekan Kirim, jam perangkat
  receivedAt: timestamp('received_at', { withTimezone: true }),               // tiba di peladen (waktu peladen)
  inspectedAt: timestamp('inspected_at', { withTimezone: true }),             // waktu resmi, lihat §7.6
  mulaiPada: timestamp('mulai_pada', { withTimezone: true }),
  durasiDetik: integer('durasi_detik'),
  clockSkewS: integer('clock_skew_s'),                                         // perkiraan selisih jam perangkat
  offline: boolean('offline').default(false).notNull(),                        // dikirim lewat antrean
  ua: varchar('ua', { length: 255 }),
  // bukti lokasi
  gpsLat: numeric('gps_lat', { precision: 10, scale: 7 }),
  gpsLng: numeric('gps_lng', { precision: 10, scale: 7 }),
  gpsAccuracy: smallint('gps_accuracy'),
  gpsCapturedAt: timestamp('gps_captured_at', { withTimezone: true }),
  jarakM: integer('jarak_m'),
  gateStatus: gateStatus('gate_status').default('tanpa_gps').notNull(),
  qrVerified: boolean('qr_verified').default(false).notNull(),
  qrVerification: varchar('qr_verification', { length: 16 }),                  // 'online' | 'offline_cache'
  // isi
  kesimpulan: kesimpulan('kesimpulan'),
  catatan: text('catatan'),
  rekomendasi: text('rekomendasi'),
  // tinjauan
  ditinjauPada: timestamp('ditinjau_pada', { withTimezone: true }),
  ditinjauOleh: integer('ditinjau_oleh').references(() => users.id, { onDelete: 'set null' }),
  catatanReview: text('catatan_review'),
  ...ts(),
}, (t) => [
  index('insp_asset_time').on(t.assetId, t.inspectedAt),
  index('insp_gate_time').on(t.gateStatus, t.inspectedAt),
  uniqueIndex('insp_satu_draf').on(t.assetId, t.userId).where(sql`status = 'draf'`),
]);

export const inspectionAnswers = pgTable('inspection_answers', {
  id: uuid('id').primaryKey(),
  inspectionId: uuid('inspection_id').notNull().references(() => inspections.id, { onDelete: 'cascade' }),
  checklistItemId: integer('checklist_item_id').notNull().references(() => checklistItems.id, { onDelete: 'restrict' }),
  nilai: text('nilai'),
  nilaiAngka: integer('nilai_angka'),
  catatan: text('catatan'),
  answeredAtDevice: timestamp('answered_at_device', { withTimezone: true }),
  ...ts(),
}, (t) => [uniqueIndex('answer_unik').on(t.inspectionId, t.checklistItemId)]);

export const inspectionPhotos = pgTable('inspection_photos', {
  id: uuid('id').primaryKey(),                                   // dibuat di perangkat
  inspectionId: uuid('inspection_id').notNull().references(() => inspections.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull(),                     // mis. inspeksi/{inspectionId}/{id}.jpg (privat)
  sha256: varchar('sha256', { length: 64 }).notNull(),
  bytes: integer('bytes'),
  width: smallint('width'), height: smallint('height'),
  takenAtDevice: timestamp('taken_at_device', { withTimezone: true }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }),
  lng: numeric('lng', { precision: 10, scale: 7 }),
  ...ts(),
});

export const issues = pgTable('issues', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  assetId: integer('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  inspectionId: uuid('inspection_id').references(() => inspections.id, { onDelete: 'set null' }),
  checklistItemId: integer('checklist_item_id').references(() => checklistItems.id, { onDelete: 'set null' }),
  item: text('item').notNull(),
  severity: severity('severity').default('sedang').notNull(),
  status: issueStatus('status').default('terbuka').notNull(),
  tindakLanjut: text('tindak_lanjut'),
  targetSelesai: date('target_selesai'),
  selesaiPada: timestamp('selesai_pada', { withTimezone: true }),
  picUserId: integer('pic_user_id').references(() => users.id, { onDelete: 'set null' }), // baru, opsional
  ...ts(),
}, (t) => [index('issues_asset_status').on(t.assetId, t.status), index('issues_status_sev').on(t.status, t.severity)]);

export const issueEvents = pgTable('issue_events', {                // baru: jejak audit tindak lanjut
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  issueId: integer('issue_id').notNull().references(() => issues.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  aksi: varchar('aksi', { length: 32 }).notNull(),               // tenggat | status | catatan
  dari: jsonb('dari'), ke: jsonb('ke'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const schedules = pgTable('schedules', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  assetId: integer('asset_id').notNull().references(() => assets.id, { onDelete: 'cascade' }),
  periode: date('periode').notNull(),
  jatuhTempo: date('jatuh_tempo').notNull(),
  inspectionId: uuid('inspection_id').references(() => inspections.id, { onDelete: 'set null' }),
  status: scheduleStatus('status').default('belum').notNull(),
  ...ts(),
}, (t) => [uniqueIndex('sched_asset_periode').on(t.assetId, t.periode), index('sched_periode_status').on(t.periode, t.status)]);

export const syncReceipts = pgTable('sync_receipts', {           // baru: idempotensi antrean offline
  key: uuid('key').primaryKey(),                                 // Idempotency-Key dari perangkat
  userId: integer('user_id').notNull().references(() => users.id),
  endpoint: varchar('endpoint', { length: 64 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  responseStatus: smallint('response_status').notNull(),
  responseBody: jsonb('response_body'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### 2.4 Pemetaan lama → baru

| Lama (SQLite) | Baru (Postgres) | Transformasi |
|---|---|---|
| `users.*` | `users` | `password` → `password_hash` apa adanya bila sudah hash bcrypt (`$2y$` diterima pustaka bcrypt Node bila prefiks diganti `$2b$`, atau verifikasi dengan pustaka yang paham `$2y$`). Akun demo (sandi teks biasa) → hash ulang, `is_demo = true`. `role = 'supervisor'` (bila masih ada) → `pemantau`. `email_verified_at`, `remember_token` dibuang. |
| `divisions` | `divisions` | sama |
| `asset_types` | `asset_types` | sama |
| `assets` | `assets` | `attributes` JSON → `jsonb`; `qr_token` **disalin persis** (stiker yang tertempel harus tetap jalan) |
| `checklist_groups`, `checklist_items` | sama | `options`, `severity_map` → `jsonb`; `answer_type` string → enum (validasi nilai) |
| `inspections.id` (int) | `inspections.id` uuid + `legacy_id` | buat UUID deterministik (UUIDv5 dari `pal-k3:inspection:{id}`) supaya skrip dapat diulang |
| `inspections.status` `draf`/`final` (atau `terkirim`/`draft` sisa lama) | `draf`/`final` | `terkirim` → `final`, `draft` → `draf` |
| `inspections.gate_status` `lolos` (sisa lama) | `sesuai` | |
| `inspections.inspected_at` | `inspected_at` + `received_at` | data lama: keduanya = `inspected_at` (waktu peladen), `offline = false` |
| `inspections.device_time` | `submitted_at_device` | waktu lokal Asia/Jakarta tanpa zona → beri zona `+07:00` {{Asumsi}}: lihat §8.3 |
| `inspection_answers` | sama, id → UUIDv5 | FK inspeksi via peta id |
| `inspection_photos.path` | `storage_key` | unggah berkas ke object storage dengan kunci baru; hitung `sha256`, `width`, `height`; `taken_at` → `uploaded_at` (bukan waktu jepret) |
| `issues` | `issues` | `inspection_id` via peta id |
| `schedules` | `schedules` | `inspection_id` via peta id |
| `sessions`, `cache*`, `jobs*`, `password_reset_tokens` | tidak dimigrasikan | |

---

## 3. Alur inspeksi lapangan

### 3.1 Token QR

- [ATURAN] Format: `PAL-K3-` + 32 karakter heksadesimal huruf kecil dari 16 byte acak
  (v2 sejak 19 Nov 2026: awalan `GIK3-`; `PAL-K3-` diterima sebagai alias, lihat ADR-17)
  kriptografis (`Asset.php:64-67`). Dibuat otomatis saat aset dibuat bila kosong (`Asset.php:56-61`).
- [ATURAN] Token **bukan** nomor aset dan tidak memuat nomor aset (uji `AssetGateTest::token_qr_acak_dan_tidak_memuat_nomor_aset`, `SeedIntegrityTest::token_tidak_memuat_nomor_aset`).
- [ATURAN] Token **tidak pernah** ada di repo, CSV seed, atau fixture
  (`database/seeders/AparSeeder.php:36-45`; uji `SeedIntegrityTest::berkas_seed_csv_tidak_memuat_token`).
  Seed ulang tidak mengganti token yang sudah ada (`seed_ulang_tidak_mengganti_token_stiker`).
- [ATURAN] Isi QR adalah URL lengkap `https://{host}/i/{token}` (`resources/views/stiker/lembar.blade.php:182`),
  sehingga kamera bawaan ponsel pun bisa membukanya. Rute dibuat pendek supaya modul QR besar dan tahan pudar (`routes/web.php:36-49`).
- [ATURAN] Pemindai di aplikasi menerima URL atau token mentah, mengambil segmen terakhir
  URL (stiker tetap berlaku walau host berganti) dan mencocokkannya dengan pola
  `/^PAL-K3-[0-9a-f]{32}$/i`; QR lain ditolak di sisi klien dengan pesan "Kode ini bukan
  stiker inspeksi K3. Coba stiker yang benar." (`resources/views/petugas/pindai.blade.php:97,118-145`).
- [ATURAN] Kode cadangan: token dicetak kecil di bawah QR (`lembar.blade.php:194`) dan dapat
  diketik manual di halaman pemindai bila kamera gagal (`pindai.blade.php:220-238`).
- [ATURAN] Pemindai butuh konteks aman (HTTPS); tanpa itu tampil peringatan (`pindai.blade.php:99-103`).
  Kamera belakang dipilih lebih dulu; ada tombol ganti kamera; kamera dilepas saat halaman ditinggal.
- [ATURAN] Token diganti hanya lewat aksi admin "Ganti token" dengan konfirmasi berbahaya;
  stiker lama langsung mati dan wajib dicetak ulang (`AssetResource.php:246-279`). Token tidak
  bisa diubah lewat formulir aset.
- [ATURAN] Token tidak pernah keluar lewat pencarian, peta dasbor, atau landing
  (`PencarianPanel.php:23-26,167-169`; `RingkasanDasbor.php:83-91`; uji `test_token_qr_tidak_bisa_dicari_dan_tidak_pernah_muncul`,
  `test_peta_tidak_membocorkan_token_qr...`, `ExampleTest::halaman_muka_tidak_membuka_token_qr_maupun_lokasi_aset`).
  Token hanya tampil di Lembar Stiker dan kolom tersembunyi "Token stiker" tabel aset (`AssetResource.php:202-207`).

### 3.2 Membuka formulir hanya setelah pindai

`GET /i/{token}` → `InspeksiController::mulai` (`InspeksiController.php:54-98`):

1. Token tidak dikenal → halaman gagal "Stiker tidak dikenali" dengan pesan lapor ke Admin K3 (`:61-66`).
2. Aset nonaktif → halaman gagal "Aset tidak aktif" (`:69-75`).
3. [ATURAN] Draf milik (aset, inspektur) yang sudah ada **dipakai ulang**; bila belum ada,
   dibuat draf baru dengan `mulai_pada = now()`, `qr_verified = true`, `ua` (`:84-95`;
   uji `pindai_ulang_memakai_draf_yang_sama`).
4. Dialihkan ke `/petugas/inspeksi/{id}`.

- [ATURAN] Tidak ada jalan lain membuat inspeksi: panel menolak `create` (`InspectionResource.php:75-79`),
  dan formulir `isi` hanya bisa dibuka untuk id draf yang sudah ada milik sendiri.
- [ATURAN] Aset ditentukan dari QR, **tidak pernah** dari posisi GPS (beberapa lantai
  berbagi satu koordinat) (`InspeksiController.php:24-32`).
- Draf yang tertinggal tampil di beranda sebagai "Belum dikirim (n)" (`BerandaController.php:47-52`).
  Draf tidak punya masa kedaluwarsa. [CELAH] v2: pertimbangkan batas umur draf.
- [ATURAN] Draf bisa dibuang (`DELETE /petugas/inspeksi/{id}`) beserta foto dan jawabannya,
  dengan konfirmasi; inspeksi final tidak bisa dibuang (403) (`InspeksiController.php:381-397`).

### 3.3 Formulir dan 10 butir checklist APAR

Formulir menampilkan grup (urut) dan butir aktif (urut) milik tipe aset
(`InspeksiController.php:101-123`). Data induk APAR (`MasterSeeder.php:61-146`), semua `wajib = true`:

```json
[
  { "grup": "A", "namaGrup": "Isi & Tekanan", "urut": 1, "label": "Volume isi tabung",
    "answer_type": "select", "options": ["Penuh", "Tidak penuh"],
    "severity_map": { "Tidak penuh": "berat" }, "severity_default": "berat",
    "dasar_hukum": "Permenaker 4/1980 Pasal 12(1)a",
    "keterangan": "Bagian 6.2: dipisah dari tekanan karena keduanya hal berbeda dan dapat berbeda hasil." },
  { "grup": "A", "urut": 2, "label": "Tekanan manometer",
    "answer_type": "select", "options": ["Zona hijau", "Kurang", "Berlebih", "Tanpa manometer"],
    "severity_map": { "Kurang": "berat", "Berlebih": "berat" }, "severity_default": "berat",
    "dasar_hukum": "Permenaker 4/1980 Pasal 12(1)a" },
  { "grup": "A", "urut": 3, "label": "Segel dan mekanik penembus",
    "answer_type": "boolean", "severity_default": "sedang", "dasar_hukum": "Permenaker 4/1980 Pasal 12(1)a" },
  { "grup": "B", "namaGrup": "Kondisi Fisik", "urut": 4, "label": "Badan tabung",
    "answer_type": "select", "options": ["Mulus", "Berkarat ringan", "Berkarat berat", "Penyok", "Harus diganti"],
    "severity_map": { "Berkarat ringan": "ringan", "Berkarat berat": "sedang", "Penyok": "sedang", "Harus diganti": "berat" },
    "severity_default": "sedang", "dasar_hukum": "Permenaker 4/1980 Pasal 12(1)b" },
  { "grup": "B", "urut": 5, "label": "Handle dan tuas",
    "answer_type": "boolean", "severity_default": "sedang", "dasar_hukum": "Permenaker 4/1980 Pasal 12(1)b" },
  { "grup": "B", "urut": 6, "label": "Label dan petunjuk pakai",
    "answer_type": "boolean", "severity_default": "ringan", "dasar_hukum": "Permenaker 4/1980 Pasal 12(1)b" },
  { "grup": "C", "namaGrup": "Saluran Pancar", "urut": 7, "label": "Mulut pancar tidak tersumbat",
    "answer_type": "boolean", "severity_default": "berat", "dasar_hukum": "Permenaker 4/1980 Pasal 12(1)c" },
  { "grup": "C", "urut": 8, "label": "Pipa atau selang pancar tidak retak",
    "answer_type": "boolean", "severity_default": "sedang", "dasar_hukum": "Permenaker 4/1980 Pasal 12(1)c" },
  { "grup": "D", "namaGrup": "Penempatan", "urut": 9, "label": "Keterjangkauan dan ketinggian",
    "answer_type": "boolean", "severity_default": "ringan",
    "dasar_hukum": "Permenaker 4/1980 Pasal 4-8 (tinggi 120 cm, jarak antar-APAR maks 15 m)" },
  { "grup": "D", "urut": 10, "label": "Tanda pemasangan dan kartu kontrol",
    "answer_type": "boolean", "severity_default": "ringan", "dasar_hukum": "Permenaker 4/1980 Pasal 4(1); NFPA 10" }
]
```

- [ATURAN] Checklist APAR: 10 butir, 4 grup, urut 1..10, setiap butir punya dasar hukum,
  **tidak ada dimensi `fungsi`** (APAR tidak dioperasikan saat inspeksi) (uji `SeedIntegrityTest::checklist_apar_sepuluh_item_empat_grup`,
  `setiap_item_checklist_punya_dasar_hukum`, `checklist_apar_tanpa_dimensi_fungsi`, `urutan_item_checklist_satu_sampai_sepuluh`).
- [ATURAN] Periode APAR 30 hari mengikuti NFPA 10; Permenaker 4/1980 hanya mewajibkan 6 dan 12 bulan, jadi
  dapat diubah admin (`MasterSeeder.php:33-36`).
- Label pilihan dua-nilai (`ChecklistItem.php:94-101`): `fungsi` → Berfungsi/Tidak berfungsi;
  `boolean` → Ada/Tidak ada; `kondisi` → Baik/Tidak baik. Nilai tersimpan `ok`/`tidak`.

**Penyimpanan per butir.** Setiap tekan pilihan langsung `POST .../jawaban` (JSON):
`{checklist_item_id, nilai?, nilai_angka?, catatan?}` (`InspeksiController.php:180-233`).

- [ATURAN] `checklist_item_id` harus butir aktif milik tipe aset inspeksi ini (`:188-191, 430-439`).
- [ATURAN] Validasi per tipe: dua-nilai ∈ {ok, tidak}; `select` ∈ `options`; `date` tanggal sah;
  `number` → `nilai` dilarang, `nilai_angka` 0..100000; selain `number` → `nilai_angka` dilarang;
  `nilai` ≤ 120 karakter; `catatan` ≤ 500 (`:190-211`; uji `jawaban_palsu_dan_angka_pada_butir_pilihan_ditolak`).
- [ATURAN] Upsert per (inspeksi, butir); respons `{tersimpan, temuan, severity, terisi, total, usulan}` (`:225-232`).
- UI: "Menyimpan…" → "✓ Tersimpan" (hilang 2,5 s) atau "⚠ Gagal disimpan. Tekan ulang pilihan Anda."
  (`resources/views/petugas/isi.blade.php:379-403`). Angka disimpan pada `change`; catatan di-debounce 900 ms dan
  tidak dikirim bila butir belum dijawab (`isi.blade.php:425-455`). Getar 30 ms saat memilih.
- Penghitung "Pemeriksaan terisi n / total" di palang bawah.
- [ATURAN] Draf final menolak semua perubahan (lokasi, jawaban, foto, hapus foto) dengan 422
  "Inspeksi sudah dikirim." (`InspeksiController.php:138-140,184-186,240-242,267-269`; uji `inspeksi_final_menolak_perubahan_lokasi_dan_penghapusan_foto`).

### 3.4 Penentuan temuan dan kesimpulan

`InspectionAnswer::severity()` (`app/Models/InspectionAnswer.php:44-69`) dan `ChecklistItem::severityUntukNilai()` (`ChecklistItem.php:73-91`):

| answer_type | Kapan menjadi temuan | Tingkat |
|---|---|---|
| `number` | `jumlah_baku` ada dan `nilai_angka < jumlah_baku` | `severity_default` (atau `sedang`) |
| `text`, `date` | tidak pernah | |
| `select` | nilai terdaftar sebagai kunci `severity_map` | nilai map; pilihan yang tak terdaftar **bukan** temuan |
| `fungsi`/`kondisi`/`boolean` | nilai `tidak` (atau kunci `severity_map`) | `severity_default` (atau `sedang`) |

- [ATURAN] Usulan kesimpulan (`app/Services/IssueGenerator.php:122-134`): tanpa temuan → `layak`;
  ada `berat` → `tidak_layak`; selain itu → `layak_catatan`. Usulan diperbarui setiap kali jawaban tersimpan;
  pilihan inspektur menang setelah ia menyentuh pilihan kesimpulan sendiri (`isi.blade.php:363-377`).
- Label kesimpulan (`app/Models/Inspection.php:15-19`): Layak pakai / Layak dengan catatan / Tidak layak pakai.

### 3.5 GPS, ambang jarak, dan "perlu ditinjau"

Pengambilan posisi berjalan **asinkron** setelah formulir terbuka (`isi.blade.php:320-350`):
`getCurrentPosition({enableHighAccuracy: true, timeout: 20000, maximumAge: 0})`, lalu
`POST .../lokasi {lat, lng, accuracy}` (`InspeksiController.php:134-171`). Validasi: lat −90..90,
lng −180..180, accuracy 0..100000 (dibulatkan ke meter).

Radius efektif (`Asset.php:93-106`): `radius_m` (override 5..500, `AssetResource.php:120-125`) bila ada, selain itu per `lokasi_tipe`:

| lokasi_tipe | Label | Radius |
|---|---|---|
| `dalam_gedung` | Dalam gedung bertingkat | 75 m |
| `bengkel` | Bengkel atau gudang | 60 m |
| `area_terbuka` | Area terbuka | 30 m |
| `kendaraan` | Kendaraan (bergerak) | tidak ada gerbang |
| tak dikenal | | 75 m (`RADIUS_BAWAAN_M`) |

Evaluasi gerbang (`Asset.php:179-221`), jarak haversine dibulatkan ke meter dengan R = 6.371.000 m (`:148-162`):

```
jika radius = null                → tidak_berlaku   (objek bergerak)
jika jarak = null                 → tanpa_gps       (perangkat atau aset tanpa koordinat)
jika accuracy > 100               → gps_lemah       (diperiksa SEBELUM jarak)
toleransi = radius + (accuracy ?? 0)
jika jarak ≤ toleransi            → sesuai
jika jarak ≤ 2 × toleransi        → perlu_review
selain itu                        → jauh
```

- [ATURAN] **GPS adalah bukti, bukan pemblokir.** Semua status tetap boleh dikirim; yang
  berbeda hanya penandaan dan antrean tinjauan (`Asset.php:175-178`, `InspeksiController.php:29-30`).
- [ATURAN] Antrean tinjauan = inspeksi `final` dengan `gate_status ∈ {perlu_review, jauh, gps_lemah, tanpa_gps}`
  dan `ditinjau_pada` kosong (`Asset.php:224-227`, `InspectionResource.php:67-73`, `RingkasanDasbor.php:29-33`).
  `sesuai` dan `tidak_berlaku` tidak masuk antrean.
- [ATURAN] GPS dikirim ulang menimpa nilai sebelumnya selama masih draf (posisi terakhir yang menang).
- Pesan kepada inspektur (`InspeksiController.php:417-427`):
  - sesuai: "Lokasi sesuai."
  - perlu_review: "Anda berjarak {j} m dari titik aset (batas {r} m). Inspeksi tetap dapat dikirim dan akan ditinjau Admin K3."
  - jauh: "Anda berjarak {j} m dari titik aset, jauh di luar batas {r} m. Pastikan stiker yang dipindai benar."
  - gps_lemah: "Sinyal GPS lemah, posisi tidak dapat dipastikan. Ini tidak dihitung sebagai pelanggaran."
  - tidak_berlaku: "Objek bergerak, pemeriksaan lokasi tidak diberlakukan."
  - lainnya: "Lokasi tidak terdeteksi. Inspeksi tetap dapat dikirim."
  - Klien: izin ditolak → "Izin lokasi ditolak. Inspeksi tetap dapat dikirim, namun akan ditandai untuk ditinjau Admin K3."; gagal → "Posisi tidak diperoleh (sinyal lemah). Inspeksi tetap dapat dikirim."
- Label dan warna lencana (`Inspection.php:81-103`): sesuai=Lokasi sesuai (hijau), perlu_review=Perlu ditinjau (kuning), jauh=Jauh dari aset (merah), gps_lemah=GPS lemah (biru), tidak_berlaku=Objek bergerak (abu), tanpa_gps=Tanpa GPS (abu).
- [ATURAN] Durasi tak wajar: `durasi_detik < 45` ditandai merah di panel dan bisa difilter, tidak ditolak (`Inspection.php:115-126`, `InspectionResource.php:166-175,209-213`).

### 3.6 Foto bukti

- [ATURAN] Minimal **1** foto wajib sebelum kirim; dicek di klien (`isi.blade.php:563-569`) dan peladen
  ("Foto wajib diunggah minimal satu sebelum inspeksi dikirim.", `InspeksiController.php:314-320`; uji `seluruh_jawaban_tanpa_foto_belum_bisa_dikirim`).
- Tidak ada batas jumlah maksimum foto. [CELAH] v2: tetapkan batas (usul 6).
- Input `<input type=file accept="image/jpeg,image/png,image/webp" capture="environment">` (`isi.blade.php:202-203`), satu foto per unggahan.
  `capture` membuka kamera belakang tetapi tidak menjamin bukan dari galeri.
- [ATURAN] Peladen menerima berkas gambar ≤ **12 MB** (`InspeksiController.php:244-248`), MIME hanya
  `image/jpeg`, `image/png`, `image/webp`; HEIC ditolak dengan pesan "Format foto tidak didukung (…). Gunakan kamera bawaan, bukan berkas HEIC." (`app/Services/PhotoStore.php:28-38`).
- [ATURAN] Pemrosesan (`PhotoStore.php:63-129`): koreksi orientasi EXIF (3→180°, 6→−90°, 8→90°) untuk JPEG;
  diperkecil ke lebar maksimum **1600 px** (tinggi proporsional, tidak diperbesar); disimpan sebagai **JPEG mutu 82**;
  nama `inspeksi/{inspection_id}/{uuid}.jpg` di disk `public`. Kompresi terjadi di **peladen**, tidak ada kompresi di klien.
- Baris foto menyimpan `taken_at = waktu unggah peladen`, `lat/lng = GPS inspeksi saat itu` (bisa null bila GPS belum tiba), `bytes` (`PhotoStore.php:50-56`).
- Foto dapat dihapus selama draf (konfirmasi "Hapus foto ini?"); berkas fisik ikut terhapus.
- [CELAH] Foto disimpan di disk publik (`/storage/inspeksi/...`) tanpa autentikasi; URL hanya
  dilindungi UUID. v2: object storage privat + URL bertanda tangan berumur pendek.
- [CELAH] Admin dan pemantau **tidak bisa melihat foto** di panel maupun laporan; foto hanya
  tampil di layar inspektur saat mengisi, dan jumlahnya di halaman selesai
  (`resources/views/petugas/selesai.blade.php:66`; tidak ada rujukan `photos` di `app/Filament`). v2 wajib menampilkannya di detail inspeksi.

### 3.7 Pengiriman (finalisasi)

`POST .../kirim` (`InspeksiController.php:285-362`), body: `kesimpulan` (wajib, ∈ 3 nilai),
`catatan` ≤ 1000, `rekomendasi` ≤ 1000, `device_time` (tanggal, dari `new Date().toISOString()` klien, `isi.blade.php:561`).

Urutan pemeriksaan, pesan dikembalikan ke formulir dengan input dipertahankan:

1. Sudah final → langsung ke halaman selesai (idempoten; tidak membangun ulang temuan; uji di `pemeriksaan_lengkap_menyimpan_bukti_temuan_dan_jadwal`).
2. Butir wajib belum terisi → "Masih ada pemeriksaan yang belum diisi: {label, …}" (`:305-311`, `:400-415`).
3. Tanpa foto → pesan di §3.6.
4. Usulan `tidak_layak` tetapi dipilih `layak` → "Terdapat temuan berat, kesimpulan tidak dapat diisi Layak pakai." (`:322-329`). Catatan: `layak_catatan` tetap boleh dipilih walau ada temuan berat.
5. Usulan bukan `layak` dan rekomendasi kosong → "Ada temuan pada inspeksi ini, rekomendasi wajib diisi." (`:331-336`).

Lalu dalam **satu transaksi** (`:338-359`):

- `status = final`, `inspected_at = now()` (**waktu peladen**), `durasi_detik = inspected_at − mulai_pada`,
  `device_time`, `kesimpulan`, `catatan`, `rekomendasi`.
- Bangun temuan (§3.8).
- `assets.terakhir_dicek = tanggal inspected_at`.
- `Schedule::pastikanAda(aset, inspected_at)->tandaiSelesai(inspeksi)` (§3.9).

Uji: waktu resmi adalah waktu peladen walau `device_time = 2020-01-01` (`pemeriksaan_lengkap_menyimpan_bukti_temuan_dan_jadwal`).

Halaman selesai (`InspeksiController.php:365-378`): ringkasan, temuan diurutkan berat → sedang → ringan, jumlah foto, tombol lanjut pindai berikutnya.

### 3.8 Temuan dan siklus tindak lanjut

`IssueGenerator::bangun` (`IssueGenerator.php:46-75`): hapus temuan milik inspeksi ini lalu buat satu
temuan per jawaban yang `severity() != null`, `status = terbuka`.

Kalimat temuan (`:81-106`):
- `select`: "{label}: {pilihan}" (mis. "Volume isi tabung: Tidak penuh").
- `number`: "{label}: {n} dari {baku} {satuan|buah}, kurang {k}".
- lainnya: "{label}: {labelNilai('tidak')}" (mis. "Handle dan tuas: Tidak ada").

Tenggat dan tindakan baku (`:25-35`), dihitung dari awal hari `inspected_at + n hari`:

| Tingkat | Tenggat | Tindakan baku (dicetak bila `tindak_lanjut` kosong) |
|---|---|---|
| berat | 3 hari | Tabung diturunkan dari layanan, diganti unit cadangan |
| sedang | 14 hari | Dijadwalkan perbaikan dalam tenggat yang ditetapkan |
| ringan | 30 hari | Dibenahi pada kunjungan berikutnya |

Siklus status saat ini:

```
terbuka ──(dasbor: Tandai selesai, wajib uraian ≥10 karakter)──▶ selesai (selesai_pada = now)
   │
   └─(dasbor: Tetapkan tenggat, tanggal ≥ hari ini)── target_selesai diubah, status tetap
proses: ada di enum tetapi hanya bisa diisi lewat formulir mentah Temuan di panel.
```

Sumber: `Dasbor.php:87-111`. Umur temuan `created_at → selesai_pada|now` dalam hari (`app/Models/Issue.php:39-44`).

- [CELAH] Halaman Temuan di panel masih scaffold bawaan: memilih aset/inspeksi/butir berdasarkan **id angka**,
  `severity` dan `status` kotak teks bebas, tanpa filter (`IssueResource.php:34-103`). Dasbor dan halaman ini
  bisa tidak konsisten. v2: satu formulir dengan pilihan terkontrol, transisi `terbuka → proses → selesai`
  (dan buka kembali oleh admin), PIC opsional, jejak audit (`issue_events`). Lihat `plan.md` Tahap 3.
- [CELAH] Tidak ada kaitan otomatis antara inspeksi berikutnya yang `layak` dengan penutupan temuan lama.

### 3.9 Jadwal dan jatuh tempo

- Periode = bulan kalender. `periode` = tanggal 1; `jatuh_tempo = periode + (periode_hari − 1)` hari
  (APAR: tanggal 30 untuk bulan 31 hari; untuk Februari melewati akhir bulan) (`app/Models/Schedule.php:44-55`).
- [ATURAN] Baris jadwal dibuat **hanya saat inspeksi difinalkan** (idempoten, satu per aset per periode);
  pemeriksaan ulang dalam bulan yang sama memakai baris yang sama dan menunjuk inspeksi terakhir
  (uji `pemeriksaan_ulang_bulan_yang_sama_memakai_satu_jadwal`). Membuka dasbor tidak membuat jadwal
  (uji `test_dasbor_kosong_tetap_terbaca_dan_get_tidak_membuat_jadwal`).
- [ATURAN] Status: `selesai` bila `inspected_at ≤ akhir hari jatuh_tempo`, selain itu `telat` (`Schedule.php:58-64`).
  Label: Terlaksana / Terlaksana (telat) / Terlewat (belum dan tenggat lewat) / Belum (`:66-73`;
  uji `jadwal_baru_telat_setelah_hari_tenggat_berakhir`).
- Beranda inspektur menghitung tenggat **turunan** tanpa menulis basis data: `jatuhTempo = awal bulan + periode − 1, akhir hari`,
  "sisa n hari (tenggat j M)", banner terlewat bila sudah lewat (`BerandaController.php:59-66`; uji `beranda_menandai_urgensi_tenggat_periode`).
- `Asset::jatuhTempo()`: belum pernah dicek, atau `terakhir_dicek + periode_hari` sudah lewat (`Asset.php:229-238`).
- [CELAH] Bulan yang terlewat tanpa inspeksi tidak punya baris jadwal, sehingga "lubang" kepatuhan
  historis tidak tercatat. v2: buat jadwal di awal periode (cron Vercel) secara idempoten (`plan.md` Tahap 4).
- [CELAH] Filter tabel aset "Jatuh tempo inspeksi" memakai 30 hari tetap dan fungsi SQLite `date('now','-30 day')`
  (`AssetResource.php:228-233`), bukan `periode_hari`.

### 3.10 Beranda dan riwayat inspektur

Beranda (`BerandaController.php:23-80`, `resources/views/petugas/beranda.blade.php`):
- Tombol besar **Pindai QR** di atas.
- Periode berjalan (nama bulan Indonesia), sisa hari dan tenggat, progres "sudah / total aset APAR aktif".
- Daftar draf milik sendiri ("Belum dikirim").
- Daftar aset APAR aktif yang belum punya inspeksi final bulan ini (oleh siapa pun), urut gedung, lantai, kode.
- Jumlah inspeksi final milik sendiri bulan ini.

Riwayat (`BerandaController.php:83-92`): inspeksi final milik sendiri, terbaru dulu, 20 per halaman, dengan temuan.

---

## 4. Fitur administrasi

Panel Filament di `/admin` (`AdminPanelProvider.php`): merek "Inspeksi K3 APAR", warna utama amber,
tanpa mode gelap, font Inter, sidebar dapat diciutkan ke ikon (Ctrl/Cmd+B), grup navigasi **Kegiatan**
(Inspeksi 1, Temuan 2, Lembar Stiker QR 8, Laporan Bulanan 9) dan **Data Induk** (Tipe Objek 1, Divisi 2,
Aset 3, Grup Checklist 4, Butir Checklist 5, Petugas 6).

### 4.1 Aset (CRUD)

Formulir (`AssetResource.php:46-145`):
- **Identitas**: Tipe objek (wajib), Nomor aset (wajib, ≤ 32, contoh "01D"), Divisi, Aktif (aset nonaktif tidak dihitung kepatuhan).
- **Penempatan**: Gedung ≤ 64, Lantai ≤ 16, Uraian lokasi (wajib ≤ 255), Jenis lokasi (wajib, 4 pilihan) dengan keterangan radius bawaan yang berubah langsung.
- **Titik koordinat**: Lintang (−90..90), Bujur (−180..180), Radius khusus 5..500 m. Kosong = gerbang GPS dilewati (`tanpa_gps`).
- **Riwayat dan atribut**: Tanggal kedaluwarsa, Terakhir dicek (baca saja), Atribut tambahan key-value (`tipe`, `kapasitas_kg`).

[CELAH] Keunikan `(tipe, kode)` hanya dijaga basis data; formulir tidak memberi pesan ramah.

Tabel (`:147-244`): Nomor, Tipe, Gedung, Lantai, Lokasi (dipotong 40), Jenis, Radius efektif ("75 m (bawaan)" / "40 m (khusus)" / "tanpa gerbang"),
Titik (ikon ✓ dengan tooltip koordinat), Divisi, Terakhir dicek (d/m/Y, "belum pernah"), Aktif, Token stiker (tersembunyi, salin).
Filter: Tipe objek, Gedung, Jenis lokasi, Aktif, Belum punya koordinat, Jatuh tempo inspeksi (uji `AssetFiltersTest`).
Aksi: Ubah, Ganti token (§3.1), hapus massal.

Aturan label lokasi (`Asset.php:254-283`; uji `LabelLokasiAsetTest`): lantai "-", "–", "—" atau kosong → tanpa lantai;
lantai berawalan "Lt"/"Lantai" dipakai apa adanya; angka → "Lt. {n}". `labelLokasi = lokasi_teks|gedung · labelLantai`, tidak pernah kosong ("-").
`labelMedia = (jenis|tipe|"APAR") + " / {kapasitas} kg"`.

Data awal: 35 APAR dari `database/seed/pal_seed_apar_35.csv` (kolom `kode,tipe,kapasitas_kg,gedung,lantai,lokasi_teks,lat,lng,radius_m`),
`lokasi_tipe` diturunkan dari nama gedung (workshop/gudang/bengkel → bengkel; terbuka/halaman/parkir → area_terbuka; lainnya dalam_gedung),
radius CSV hanya disimpan bila berbeda dari bawaan jenisnya, desimal koma dibaca (`AparSeeder.php:14-127`).

### 4.2 Data induk lain

Formulir scaffold sederhana, hanya admin yang menulis:
- **Tipe Objek**: slug, nama, bergerak, periode_hari, urut, aktif.
- **Divisi**: nama, kode, aktif.
- **Grup Checklist**: tipe objek, kode, nama, urut.
- **Butir Checklist**: grup (isian id angka), label, answer_type (teks bebas), jumlah_baku, satuan, dasar_hukum, severity_default, wajib, urut, aktif.
  [CELAH] Tidak ada editor `options`/`severity_map`, answer_type teks bebas tanpa validasi. v2: editor terkontrol.

### 4.3 Peta

Peta SVG yang dirender peladen di dasbor (`RingkasanDasbor.php:93-184`, komponen `resources/views/components/admin/area-peta.blade.php`),
tanpa ubin peta pihak ketiga:
- Proyeksi linier lat/lng ke kanvas 460×320 dengan tepi 44/40 px; rentang nol dilebarkan ±5e-5 supaya tidak membagi nol.
- Zona: "Semua" + satu zona per area (`gedung · labelLantai`). Di zona Semua, lantai berbeda pada gedung yang sama digeser mendatar 16 px per lantai; label gedung hanya bila titiknya mengelompok (sebaran < 45% kanvas).
- Setiap titik membawa hanya: kode, area, gedung, lantai, lokasi, lat, lng, status (`belum` / kesimpulan inspeksi final terakhir bulan ini / `tanpa_kesimpulan`), `tinjau` (ada di antrean tinjauan). **Tidak ada token.**
- Aset tanpa koordinat dihitung di `tanpa_titik`, tidak digambar.
- Uji: `RedesainPanelTest::test_peta_*`, `test_aset_tanpa_koordinat_dihitung_tetapi_tidak_digambar`, `test_zona_satu_titik_atau_berkoordinat_sama_tidak_membagi_dengan_nol`.

### 4.4 Lembar stiker QR

`GET /stiker` (`app/Http/Controllers/StikerController.php`, `resources/views/stiker/lembar.blade.php`), HTML untuk dicetak lewat dialog cetak peramban (bukan PDF).

- Filter: tipe (slug), gedung, lantai, **kode** (dipisah koma, untuk cetak ulang satu-dua stiker), tata letak. Hanya aset aktif. Urut gedung, lantai, kode.
- Tata letak (`StikerController.php:27-31`), kertas label A4 potret, margin halaman 0, lembar padding 8 mm × 5 mm:

| Kode | Label per lembar | Ukuran label |
|---|---|---|
| `3x8` | 24 (3 kolom × 8 baris) | 63,5 × 33,9 mm |
| `2x5` (bawaan) | 10 (2 × 5) | 99,1 × 57 mm |
| `2x4` | 8 (2 × 4) | 99,1 × 67,7 mm |

- Isi label: QR SVG (`errorCorrection M`, margin 0) berisi URL `/i/{token}`, lebar 26 mm bila tinggi label > 40 mm, selain itu 20 mm;
  kode aset tebal (4,6 / 3,8 mm); jenis (huruf kapital); lokasi; perintah singkat; token kecil 1,9 mm sebagai kode cadangan.
- Navigasi atas (ke panel dan laporan) disembunyikan saat cetak (uji `TautanSilangPengelolaTest`).

### 4.5 Petugas (pengguna)

`UserResource.php` (hanya admin): field NIP/username (wajib, ≤ 32, unik), Nama, Surel (wajib, unik), Peran, Divisi,
Jabatan, Kata sandi (8..128, wajib saat buat, kosongkan saat ubah untuk mempertahankan), Akun aktif.
Tidak ada hapus. Admin tidak bisa mengubah peran atau menonaktifkan dirinya sendiri.
Uji: `UserManagementTest` (petugas baru bisa login; ubah tanpa sandi mempertahankan sandi; nonaktif tidak bisa login).

### 4.6 Antrean tinjauan

Dua pintu yang harus konsisten (uji `DaftarInspeksiTest::test_tinjauan_panel_dan_dasbor_konsisten_dan_bisa_diselesaikan` untuk keempat status):

1. **Inspeksi** (`InspectionResource.php`, `.../Pages/ListInspections.php:28-56`): lencana menu = jumlah antrean;
   tab Antre ditinjau (bawaan bila ada antrean) / Lokasi menyimpang / Tidak layak pakai / Semua.
   Kolom: Waktu (d/m/Y H:i), Aset, Lokasi, Inspektur, QR ✓, Gerbang (lencana), Jarak + akurasi, Kesimpulan, Durasi (merah < 45 s), Status, Ditinjau (tooltip alasan).
   Filter: Antre ditinjau, Status gerbang, Kesimpulan, Inspektur, Durasi tak wajar. Tanpa aksi massal.
   Halaman Lihat (bawaan klik) dan Ubah: bagian "Bukti lapangan (tidak dapat diubah)" seluruhnya terkunci, bagian "Hasil tinjauan admin" hanya `catatan_review` yang bisa diisi.
   Aksi **Tandai ditinjau**: hanya admin, hanya bila masih perlu tinjauan; alasan wajib ≥ 10 karakter; mengisi `ditinjau_pada`, `ditinjau_oleh`, tidak pernah mengubah angka GPS.
2. **Dasbor**, tab "Tinjauan posisi" (§4.7).

### 4.7 Dasbor admin (`Dasbor.php`, `RingkasanDasbor.php`, `resources/views/filament/pages/dasbor.blade.php`)

Judul "Halo, {nama}", subjudul "{hari, tanggal bulan tahun} · Periode {bulan tahun}", tombol header "Laporan bulanan".
Semua angka **hanya APAR aktif** (`RingkasanDasbor.php:14-17`).

- **Kartu kepatuhan**: `persen = diperiksa / total × 100` (1 desimal, koma), "{d} dari {t} unit diperiksa"; diperiksa = aset aktif
  dengan ≥ 1 inspeksi final dalam bulan berjalan (dihitung sekali per unit, uji `test_kepatuhan_menghitung_unit_aktif_sekali_dan_kondisi_terbaru`).
- **Empat kartu-tab** (hanya nilai `berat|lewat|posisi|belum` diterima, `#[Locked]`, `Dasbor.php:40-45`):

| Tab | Isi antrean (6 per halaman) | Aksi |
|---|---|---|
| Temuan berat | temuan belum selesai, severity berat, terlama dulu | Tetapkan tenggat, Tandai selesai |
| Lewat tenggat | temuan belum selesai, `target_selesai < hari ini`, tenggat terdekat dulu | sama |
| Tinjauan posisi | antrean tinjauan, terlama dulu; tampil inspektur, waktu, jarak, akurasi | Lihat bukti ↗, Tinjau posisi |
| Belum diperiksa | aset aktif tanpa inspeksi final bulan ini, urut kode | Kartu pemeriksaan ↗ |

  Halaman dikoreksi otomatis bila entri terakhir di halaman itu selesai diproses (uji `test_halaman_antrean_disesuaikan_setelah_entri_terakhir_diproses`).
- **Kondisi**: jumlah unit per kesimpulan inspeksi final **terakhir** bulan ini.
- **Tren 6 bulan**: jumlah aset unik yang diinspeksi per bulan (label bulan singkat Indonesia).
- **Area**: per `gedung · lantai`, progres sudah/total.
- **Peta** (§4.3). "Sisa n hari" = hari menuju akhir bulan.

### 4.8 Pencarian Ctrl+K (`PencarianPanel.php`)

- Pintasan `Ctrl+K` / `Cmd+K` (tanpa `/`), debounce 250 ms (`AdminPanelProvider.php:54-57`).
- Kolom kosong atau 1 huruf → **saran**: Halaman (≤ 12), Tindakan (admin), Inspeksi terbaru (3 final terakhir). Tidak membuka sendiri.
- ≥ 2 huruf → kelompok, maksimal 5 per kelompok:
  - **Halaman**: item navigasi yang labelnya memuat kata (hanya yang boleh dilihat peran itu).
  - **Tindakan** (admin): "Tambah aset", "Cetak lembar stiker QR".
  - **Aset** (admin): kode/gedung/lantai/lokasi_teks LIKE; judul "{kode} · {labelLokasi}", rincian Lokasi dan "Nonaktif"; tautan ke ubah aset.
  - **Temuan**: item atau kode aset LIKE; yang belum selesai dulu; admin → halaman ubah, pemantau → daftar temuan.
  - **Inspeksi**: kode aset atau nama petugas LIKE; final terbaru dulu; judul "Inspeksi {kode}", rincian Petugas, Waktu ("d M Y, H.i" atau "Draf"), Kesimpulan.
- [ATURAN] `%` dan `_` diketik apa adanya (escape `!`); `qr_token` tidak pernah dipilih/dicari/ditampilkan; tidak menulis ke basis data.

### 4.9 Laporan bulanan dan ekspor

`GET /laporan` (`app/Http/Controllers/LaporanController.php`, `resources/views/laporan/indeks.blade.php`): pilih tipe
(bawaan `apar`), tahun (2020..2100; daftar tahun = tahun yang punya inspeksi final + tahun ini), bulan (1..12), gedung.
Menampilkan ringkasan, tombol unduh dua PDF, dan tabel rincian per unit (Kode, Lokasi, Tanggal periksa, Petugas,
Kesimpulan, Temuan, Bukti posisi, Kartu kontrol).

Sumber data satu periode (`LaporanController.php:127-199`):
- Aset = **aset aktif saat ini** dari tipe itu (dan gedung), urut gedung, lantai, kode. Aset yang tidak diinspeksi tetap tampil sebagai baris kosong.
- Butir = butir aktif tipe itu, urut grup lalu butir.
- Inspeksi = final dalam bulan itu, satu per aset (**yang terakhir** bila lebih dari satu).
- Temuan = semua temuan **belum selesai** milik aset tersebut (tidak dibatasi periode), urut berat → sedang → ringan, lalu terlama.
- Ringkasan: total, diperiksa, belum, kepatuhan %, layak, layak dengan catatan, tidak layak, temuan berat terbuka,
  perlu tinjauan = inspeksi periode dengan gate ∈ {jauh, perlu_review, gps_lemah}.

[CELAH] "Perlu tinjauan" di laporan berbeda dari antrean: tidak memasukkan `tanpa_gps` dan tidak mengecualikan yang sudah ditinjau
(`LaporanController.php:195` vs `Asset.php:224-227`). v2: samakan dengan antrean, atau beri label berbeda.
[CELAH] Laporan periode lampau memakai daftar aset hari ini (aset yang sudah dinonaktifkan hilang dari laporan lama).

#### Lembar PMS (PDF) `GET /laporan/pms?tipe&tahun&bulan&gedung`

dompdf, **A4 lanskap**, margin 12/10/14 mm, font DejaVu Sans 7,5 pt (wajib untuk Ø), dialirkan inline dengan nama
`PMS-{TIPE}-{tahun}-{bulan 2 digit}.pdf` (`LaporanController.php:45-57`, `resources/views/laporan/pms.blade.php`).
Contoh: [samples/contoh-pms-apar-2026-10.pdf](samples/contoh-pms-apar-2026-10.pdf).

1. **Kop**: kiri "PERUSAHAAN GALANGAN KAPAL" / "Geofencing: Sistem Inspeksi Sarana Tanggap Darurat K3" (anonim, PRD F19);
   kanan "PREVENTIVE MAINTENANCE SCHEDULE" / "Lampiran 03 dari 04" / "Dicetak {d M Y H:i} WIB".
2. **Judul**: "LAPORAN PEMERIKSAAN BERKALA {TIPE}", lalu "Periode {Bulan} {Tahun} [· Gedung X] · {n} unit terdaftar".
3. **Matriks** (kepala tabel berulang di tiap halaman):

| Kode 9% | Lokasi 17% | Tanggal 6% | [kelompok grup: Isi & Tekanan · Kondisi Fisik · Saluran Pancar · Penempatan] kolom 1..10 (3,2% tiap) | Kesimpulan 8% | Petugas 9% |
|---|---|---|---|---|---|

   - Lokasi = `lokasi_teks|gedung` + "(Lt. n)" kecil. Tanggal = `d/m` inspected_at.
   - Sel butir = simbol (`InspectionAnswer.php:83-111`): `fungsi` ✓ / X; `kondisi` dan `boolean` O / Ø;
     `select` O bila bukan temuan, Ø bila temuan (teks pilihan masuk temuan); `number` angka; lainnya nilai mentah; tanpa jawaban "-".
   - Baris aset yang belum diperiksa: latar abu, miring, semua "-", Kesimpulan "Belum diperiksa", Petugas "-".
4. **Nomor butir**: daftar "n. Label (dasar hukum)" dalam 4 kolom.
5. **Keterangan simbol**: "✓ berfungsi · X tidak berfungsi · O kondisi baik · Ø kondisi tidak baik · - tidak diperiksa", lalu
   "Dasar hukum: Permenaker No. 4 Tahun 1980 … serta NFPA 10 untuk periode pemeriksaan bulanan."
6. **Ringkasan** (tabel 2×2 + baris opsional): Unit terdaftar · Tingkat kepatuhan "{x,y}% ({d} diperiksa, {b} belum)" ·
   Hasil pemeriksaan "Layak a · Layak dengan catatan b · Tidak layak c" · Temuan berat terbuka "{n} butir" ·
   (bila > 0) Perlu tinjauan "{n} pemeriksaan memiliki catatan posisi yang perlu ditinjau Admin K3 sebelum laporan disahkan."
7. **Tanda tangan** 3 kolom: "Diperiksa oleh / Petugas K3", "Diverifikasi oleh / Supervisor K3LH", "Disetujui oleh / Kepala Divisi K3LH", masing-masing garis + "Nama dan tanggal".
8. **Kaki tetap** tiap halaman: "Dokumen dihasilkan Sistem Inspeksi K3 Perusahaan Galangan Kapal. Baris berlatar abu menandakan unit yang belum diperiksa pada periode ini."

[ATURAN] Dua dimensi simbol tidak boleh digabung (✓/X = fungsi, O/Ø = kondisi) (uji `InspectionAnswerTest::empat_simbol_pms_tidak_saling_tertukar`).

#### Rekap temuan (PDF) `GET /laporan/temuan`

A4 potret, nama `Rekap-Temuan-{tahun}-{bulan}.pdf` (`LaporanController.php:60-68`, `resources/views/laporan/temuan.blade.php`).
Judul "Rekapitulasi Temuan {tipe}"; ringkasan: Temuan terbuka, Tingkat berat, Lewat tenggat, Unit terdampak "x dari y unit";
tabel: No 4% · Kode unit 11% · Lokasi 17% · Temuan 24% · Tingkat 9% · Tindakan yang diminta 19% (`tindak_lanjut` atau tindakan baku) ·
Tenggat 9% (ditandai bila lewat) · Status 7%. Contoh: [samples/contoh-rekap-temuan-2026-10.pdf](samples/contoh-rekap-temuan-2026-10.pdf).

#### Kartu kontrol (PDF) `GET /laporan/kartu/{asset}?tahun`

A4 potret, `Kartu-Kontrol-{kode}-{tahun}.pdf` (`LaporanController.php:77-97`, `resources/views/laporan/kartu.blade.php`).
Identitas: Kode unit, Jenis media, Lokasi, Gedung + lantai, Divisi, Masa kedaluwarsa. Tabel 12 baris bulan:
Bulan 15% · Tanggal 12% · Petugas pemeriksa 24% · Kesimpulan 19% · Temuan 10% · Paraf (kosong).
Contoh: [samples/contoh-kartu-kontrol.pdf](samples/contoh-kartu-kontrol.pdf).

**Ekspor lain**: tidak ada ekspor CSV/Excel. Hanya tiga PDF di atas. {{Asumsi}} pemilik mungkin meminta CSV di v2; tidak wajib.

---

## 5. Tampilan Pemantau

- Masuk lewat `/masuk` atau `/admin/login` dengan NIP; diarahkan ke `/admin`.
- Dasbor versi manajemen (`Dasbor.php:53-56`, `dasbor.blade.php` cabang `$pemantau`), subjudul diberi " · Akses hanya baca":
  - **Ringkasan untuk manajemen**: narasi otomatis (`RingkasanDasbor.php:196-212`):
    - tanpa aset: "Belum ada APAR aktif. Ringkasan akan terisi setelah aset dan inspeksi tersedia."
    - tanpa inspeksi: "Belum ada inspeksi bulan ini. {t} APAR aktif menunggu pemeriksaan sebelum akhir bulan (sisa {h} hari)."
    - selain itu: "{d} dari {t} APAR sudah diperiksa bulan ini ({p}%). {x} unit dinyatakan tidak layak pakai. Ada {b} temuan berat dan {l} temuan lewat tenggat yang belum selesai, serta {q} inspeksi yang menunggu tinjauan posisi."
  - Tiga angka: % kepatuhan, unit tidak layak, temuan lewat tenggat.
  - **Risiko terbuka**: 5 temuan belum selesai, berat dulu lalu tenggat terdekat (tanpa tenggat paling akhir) (`RingkasanDasbor.php:187-193`), dengan tanda "Berat", "Lewat tenggat", atau "Perlu perhatian".
  - **Laporan siap cetak**: Laporan PMS bulanan (Unduh PDF), Rekap temuan, Kartu kontrol per unit (Pilih unit → `/laporan`).
  - **Kepatuhan {bulan}**: persen besar, "{d} dari {t} unit · sisa {h} hari", progres per area.
  - Tren dan peta sama dengan admin.
- Tidak ada antrean keputusan dan tidak ada tombol tulis (uji `test_pemantau_melihat_ringkasan_manajemen_tanpa_antrean_dan_aksi_tulis`);
  admin tidak melihat ringkasan manajemen (`test_admin_tidak_melihat_ringkasan_manajemen_pemantau`).
- Menu: Inspeksi, Temuan (lihat), Lembar Stiker QR, Laporan Bulanan. Menu Data Induk tersembunyi; Petugas 403.
- Pencarian: halaman yang boleh dilihat, temuan (ke daftar), inspeksi; tanpa aset dan tindakan.

---

## 6. Non-fungsional

### 6.1 Bahasa, zona waktu, format

- Locale `id` (env `APP_LOCALE=id` di `.env.example`; bawaan `config/app.php:87` masih `en`), Carbon disetel eksplisit
  ke locale aplikasi supaya nama bulan Indonesia (`app/Providers/AppServiceProvider.php:37-41`). Faker `id_ID`.
- Zona waktu `Asia/Jakarta` (`config/app.php:74`); stempel di PDF ditulis "WIB". Waktu disimpan sebagai waktu lokal tanpa zona di SQLite.
  v2: simpan `timestamptz` (UTC), tampilkan `Asia/Jakarta`.
- Format: tanggal tabel `d/m/Y`, waktu `d/m/Y H:i`, pencarian `d M Y, H.i`, persen 1 desimal dengan koma (`85,7%`), bulan penuh Indonesia (Januari..Desember).
- Pesan validasi Indonesia: `lang/id/validation.php` (mis. "`:attribute` wajib diisi."), nama atribut ramah ("NIP", "kata sandi", "kesimpulan", "rekomendasi", "foto").
- Halaman galat Indonesia untuk 403, 404, 419, 429, 500, 503 (`resources/views/errors/*`), dengan jalan pulang sesuai peran (uji `HalamanGalatTest`).
- Landing publik tanpa emoji (uji `halaman_muka_tanpa_emoji`), tanpa data aset/token/koordinat; kartu modul dari `asset_types`.

### 6.2 Keamanan

| Aturan | Sumber |
|---|---|
| Batas percobaan masuk `/masuk`: 5 gagal per kunci `nip|ip`, kunci 60 s, pesan "Terlalu banyak percobaan. Coba lagi dalam {n} detik."; berhasil membersihkan hitungan | `AuthController.php:24-26,47-71` |
| Batas percobaan masuk panel: 5 per menit (bawaan Filament `rateLimit(5)`) | `vendor/filament/filament/src/Pages/Auth/Login.php:56` |
| Regenerasi sesi saat masuk; invalidasi + token CSRF baru saat keluar | `AuthController.php:72,87-89` |
| CSRF pada semua POST/DELETE (formulir `@csrf`, fetch `X-CSRF-TOKEN`) | `isi.blade.php:297-304`, `AdminPanelProvider.php:107` |
| Sesi basis data, umur 120 menit | `.env.example` `SESSION_LIFETIME=120` |
| Kepemilikan draf dicek di setiap endpoint inspeksi (403) | `InspeksiController.php:447-450` |
| Inspeksi final kebal perubahan (422/403) | §3.3, §3.2 |
| Bukti lapangan tidak dapat disunting dari panel | `InspectionResource.php:17-29,84-98` |
| Token QR tidak bocor (landing, pencarian, peta) | §3.1 |
| LIKE di-escape | `PencarianPanel.php:72-75` |
| Proxy tepercaya hanya localhost (cloudflared di mesin yang sama) | `bootstrap/app.php:37-43` |
| JSON untuk permintaan `expectsJson` | `bootstrap/app.php:46-48` |
| Sandi minimal 8 (panel), hash bcrypt | `UserResource.php:59-60`, `User.php:51` |

[CELAH] Tidak ada batas laju untuk `/i/{token}` (tebakan token secara praktis mustahil: 128 bit, tetapi v2 tetap sebaiknya membatasi).
[CELAH] Tidak ada jejak audit untuk perubahan data induk dan temuan.

### 6.3 Uji yang menyandikan aturan bisnis

Semua menjadi uji penerimaan v2 (lihat [ACCEPTANCE.md](ACCEPTANCE.md) yang menomori ulang per area).

| Berkas | Aturan yang diuji |
|---|---|
| `tests/Unit/AssetGateTest.php` | haversine 0 di titik sama, wajar untuk geser kecil; jarak null bila salah satu tanpa koordinat; radius bawaan; evaluasi gerbang 6 kasus (10 m, 50 m → sesuai; 200 m → jauh; akurasi 120 → gps_lemah; null → tanpa_gps); akurasi lemah menang atas jarak; akurasi menambah toleransi; token acak tanpa nomor aset |
| `tests/Unit/InspectionAnswerTest.php` | simbol fungsi ✓/X, kondisi O/Ø, 4 simbol tak tertukar, number menampilkan angka; nilai `ok` bukan temuan; kurang dari baku = temuan; kekurangan dihitung; null untuk non-angka; tanpa baku bukan temuan; deteksi dua-nilai |
| `tests/Unit/LabelLokasiAsetTest.php` | aturan label lantai dan lokasi (7 kasus) |
| `tests/Feature/AlurLapanganTest.php` | pemindai terbuka untuk inspektur; token sah → draf + alih ke formulir; formulir merender; pindai ulang memakai draf sama; token tak dikenal → halaman gagal; beranda dan riwayat; urgensi tenggat; tabel inspeksi admin dengan baris draf; alur lengkap (baik → 0 temuan, berat → 1 temuan, waktu peladen, jadwal selesai, terakhir_dicek, foto tersimpan, kirim ulang idempoten); final menolak lokasi & hapus foto; tanpa foto tidak bisa kirim; temuan berat tidak bisa `layak` dan butuh rekomendasi; jawaban palsu dan angka pada butir pilihan ditolak; akun panel tidak membuat draf; jadwal telat setelah hari tenggat; satu jadwal untuk pemeriksaan ulang sebulan |
| `tests/Feature/AdminPanelSmokeTest.php` | tamu → halaman masuk; daftar & buat setiap resource merender; aset seed tampil; 404 panel; inspektur ditolak panel; pemantau boleh; admin nonaktif ditolak; peran bawaan inspektur |
| `tests/Feature/OtorisasiPanelTest.php` | pemantau tidak bisa menulis di semua resource, tidak bisa ubah/hapus aset, tetap bisa melihat daftar aset; admin bisa menulis; inspeksi tidak bisa dibuat dari panel bahkan oleh admin |
| `tests/Feature/DaftarInspeksiTest.php` | menu inspeksi dengan antrean, tab dan filter; pemantau bisa membuka; tinjauan panel dan dasbor konsisten untuk perlu_review/jauh/gps_lemah/tanpa_gps |
| `tests/Feature/RedesainPanelTest.php` | kepatuhan per unit sekali dan kondisi terbaru; antrean mengecualikan temuan selesai dan inspeksi yang sudah ditinjau; dasbor kosong & GET tidak membuat jadwal; tab dan paginasi; koreksi halaman; tab terkunci; tinjauan wajib alasan & tidak mengubah GPS; tenggat & selesai; pemantau tidak bisa memanggil aksi tulis; login panel NIP; peta (semua titik dalam kanvas, tanpa token, tanpa titik dihitung, tidak bagi nol, status & tinjau); ringkasan pemantau; risiko diurutkan; narasi; merek & favicon |
| `tests/Feature/PencarianPanelTest.php` | 17 aturan pencarian (§4.8) |
| `tests/Feature/UserManagementTest.php` | buat petugas yang bisa login; ubah tanpa sandi; pemantau tidak bisa kelola petugas; nonaktif sebagai pengganti hapus |
| `tests/Feature/DemoLoginTest.php` | 7 aturan mode demo (§1.3) |
| `tests/Feature/SeedIntegrityTest.php` | 4 tipe objek; hanya damkar bergerak; periode APAR 30; 35 APAR dari CSV; token unik, tanpa nomor aset, tidak ada di CSV, tidak berubah saat seed ulang; koordinat & radius; koordinat dipakai bersama; satu titik beda lantai; atribut numerik; label media; checklist 10 butir/4 grup/dasar hukum/tanpa fungsi/urut 1..10; seeder idempoten; belum dicek = jatuh tempo |
| `tests/Feature/AssetFiltersTest.php` | filter koordinat menghormati filter gedung; filter jatuh tempo aman dari injeksi |
| `tests/Feature/HalamanGalatTest.php` | 404 Indonesia; tautan sesuai peran; inspektur di `/stiker` mendapat 403 yang menjelaskan |
| `tests/Feature/TautanSilangPengelolaTest.php` | stiker & laporan punya jalan ke panel; navigasi stiker tersembunyi saat cetak; pemantau melihat tautan; inspektur ditolak |
| `tests/Feature/ExampleTest.php` | landing: 4 kartu modul dengan status siap; tamu melihat tautan masuk; pengguna masuk melihat tautan ke aplikasinya; tanpa token & lokasi; tanpa emoji |
| `tests/qa-browser/*.py` | skenario peramban nyata (Playwright) per peran; acuan uji E2E v2 |

---

## 7. Rancangan offline untuk v2

Kebutuhan pemilik: inspektur mengisi formulir dengan sinyal lemah atau tanpa sinyal, dan
data terkirim sendiri saat kembali daring. Aplikasi saat ini menyimpan per butir lewat
`fetch` dan **gagal** tanpa jaringan (`isi.blade.php:379-403`); GPS, foto, dan kirim semuanya butuh peladen.

### 7.1 Prinsip

1. **Perangkat adalah sumber kebenaran selama draf.** Semua isian ditulis dulu ke IndexedDB, baru dikirim.
2. **Peladen tetap penentu final.** Aturan bisnis (§3.4, §3.7) dijalankan ulang di peladen saat sinkron; klien hanya menjalankan salinannya untuk umpan balik.
3. **Bukti dicatat saat mengisi, bukan saat terkirim.** GPS, waktu pindai, waktu kirim, dan foto diambil di lokasi.
4. **Tidak ada penolakan diam-diam.** Setiap item antrean punya status yang terlihat dan tindakan pemulihan.
5. Aturan lama "GPS bukti, bukan pemblokir" dan "QR penentu aset" tetap berlaku.

### 7.2 Komponen

- **PWA**: manifest + Service Worker (Serwist/Workbox untuk Next.js). Pra-cache app shell untuk
  `/petugas`, `/petugas/pindai`, `/petugas/isi/[id]`, pustaka pemindai QR, dan font. Halaman yang
  belum pernah dibuka tetap tersedia offline.
- **IndexedDB** (lewat Dexie atau `idb`), basis data per akun `pal-k3:{userId}`:

| Store | Kunci | Isi |
|---|---|---|
| `meta` | `key` | `userId`, `lastSyncAt`, versi data induk, `serverClockOffsetMs` |
| `assets` | `id` | aset aktif yang boleh diinspeksi: id, kode, tipe, label lokasi, lat, lng, radius efektif, `periodeHari`, **`qrTokenHash`** (lihat §7.7) |
| `checklist` | `assetTypeId` | grup + butir aktif lengkap dengan `options`, `severityMap`, `severityDefault`, `jumlahBaku`, `wajib`, versi |
| `drafts` | `inspectionId` (UUIDv7) | assetId, status lokal, `scannedAtDevice`, `qrVerification`, GPS (lat, lng, accuracy, `capturedAt`), jawaban per butir (`nilai`, `nilaiAngka`, `catatan`, `answeredAt`), kesimpulan, catatan, rekomendasi, `submittedAtDevice`, `clientSeq` |
| `photos` | `photoId` (UUID) | `inspectionId`, **Blob JPEG terkompresi**, `sha256`, `takenAtDevice`, lat/lng saat jepret, ukuran |
| `outbox` | `opId` (UUID = Idempotency-Key) | jenis (`upsert-draft`, `upload-photo`, `delete-photo`, `finalize`, `discard`), `inspectionId`, payload, `attempts`, `nextAttemptAt`, `lastError`, status |
| `sent` | `inspectionId` | ringkasan inspeksi yang sudah final di peladen (untuk layar "Terkirim"), dipangkas setelah 30 hari |

- Data sensitif dihapus saat keluar (§7.10).

### 7.3 Alur offline

1. **Masuk** (wajib daring sekali). Setelah masuk, klien mengunduh paket kerja: aset, checklist,
   hash token, jam peladen. Disegarkan setiap kali daring dan setiap 24 jam; menampilkan "Data
   stiker terakhir diperbarui {waktu}". Sesi v2 untuk inspektur sebaiknya berumur panjang (mis. 30 hari, dapat dicabut) supaya tidak terkunci di lapangan.
2. **Pindai** di pemindai dalam aplikasi (kamera bawaan ponsel membuka URL; bila offline, Service
   Worker menangani `/i/{token}` dan meneruskannya ke pemindai lokal).
   - Daring: `POST /api/inspections/start {token, inspectionId, scannedAtDevice}` seperti sekarang (pakai ulang draf yang ada).
   - Luring: cocokkan `sha256(token + salt)` dengan cache (§7.7). Cocok → buat draf lokal dengan
     `inspectionId = UUIDv7`, `qrVerification = 'offline_cache'`. Draf lokal yang sudah ada untuk aset itu dipakai ulang.
     Tidak cocok → "Stiker tidak dikenali atau data stiker belum diperbarui. Simpan foto stiker dan coba saat ada sinyal." (draf tidak dibuat).
3. **GPS** diminta begitu formulir terbuka (`enableHighAccuracy: true, timeout: 20000, maximumAge: 0`).
   Gerbang dihitung di klien dengan rumus §3.5 untuk ditampilkan; nilai mentah (lat, lng, accuracy,
   `capturedAt`) disimpan di draf. Bisa diulang ("Ambil ulang posisi"); bacaan dengan akurasi terbaik
   dalam jendela pengisian dipakai. Peladen menghitung ulang `jarak_m` dan `gate_status` dari nilai mentah.
4. **Jawaban** ditulis ke IndexedDB per ketukan (tanpa jaringan), ditandai "Tersimpan di perangkat".
   Validasi per tipe dan usulan kesimpulan dijalankan di klien dari data checklist yang di-cache.
5. **Foto**: dikompresi di klien (§7.4), Blob disimpan di store `photos` sebelum apa pun dikirim.
6. **Kirim**: klien menjalankan semua pemeriksaan §3.7 secara lokal. Lolos → `submittedAtDevice = now`,
   status lokal `antre`, operasi `finalize` masuk outbox. Layar langsung menampilkan "Masuk antrean,
   akan dikirim otomatis saat ada sinyal" dan inspektur bisa memindai tabung berikutnya.
7. **Sinkron** (§7.5) mengirim foto lebih dulu, lalu `finalize` berisi seluruh isi draf.

Bila daring, alur yang sama tetap lewat outbox (satu jalur kode); outbox langsung terkuras.

### 7.4 Foto di perangkat

- Ambil lewat `<input type=file accept="image/*" capture="environment">`.
- Kompresi di klien sebelum disimpan: decode (`createImageBitmap` dengan `imageOrientation: 'from-image'`
  untuk orientasi EXIF), perkecil ke lebar maks **1600 px**, encode **JPEG mutu 0,82** lewat `OffscreenCanvas.convertToBlob`
  (aturan sama dengan peladen sekarang). Target ≤ ~500 KB. HEIC: coba decode lewat peramban
  (Safari bisa); bila gagal, pesan sama seperti sekarang.
- Simpan `sha256` Blob; peladen menolak unggahan yang hash-nya tidak cocok.
- Batas: ≥ 1 foto wajib, maksimum 6 per inspeksi {{Asumsi}}, ≤ 12 MB per berkas sebelum kompresi.
- Minta `navigator.storage.persist()` saat pertama kali menyimpan foto, supaya peramban tidak membuang data antrean ketika ruang menipis. Tampilkan peringatan bila kuota hampir habis (`navigator.storage.estimate()`).
- Unggah: `PUT /api/inspections/{inspectionId}/photos/{photoId}` (idempoten per `photoId`), atau URL unggah bertanda tangan ke object storage lalu konfirmasi. Blob dihapus dari perangkat hanya setelah `finalize` diterima.

### 7.5 Antrean, idempotensi, coba ulang

- Setiap operasi outbox membawa header `Idempotency-Key: {opId}`. Peladen menyimpan
  `(key, user, endpoint, hash request, status, body)` di `sync_receipts`; permintaan berulang dengan kunci sama
  mengembalikan respons tersimpan; kunci sama dengan isi berbeda → 422.
- Id alami juga idempoten: `inspectionId` dan `photoId` UUID buatan perangkat; `finalize` pada inspeksi yang sudah final
  mengembalikan 200 dengan hasil yang sama (perilaku sekarang, §3.7 langkah 1).
- Urutan per inspeksi dijaga (FIFO per `inspectionId`); antar-inspeksi boleh paralel (maks 2).
- Pemicu pengurasan: `online` event, `visibilitychange` ke terlihat, setelah setiap penulisan, timer, dan **Background Sync**
  (`registration.sync.register('outbox')`) di Chromium/Android. iOS Safari tidak punya Background Sync: kuras saat
  aplikasi dibuka atau kembali ke depan, dan beri tombol "Kirim sekarang". Periodic Background Sync tidak diandalkan.
- Coba ulang dengan backoff eksponensial + jitter: 2 s, 4 s, 8 s … maks 5 menit; tidak ada batas jumlah untuk galat jaringan/5xx/429 (hormati `Retry-After`).
- Galat yang **tidak** dicoba ulang otomatis, ditampilkan dengan tindakan:
  - 401 sesi habis → "Masuk lagi untuk mengirim antrean" (antrean tetap utuh; setelah masuk ulang dengan akun **yang sama** pengurasan berlanjut).
  - 403 bukan milik / peran berubah → "Tidak berwenang"; minta hubungi admin.
  - 409/410 aset nonaktif atau token diganti (§7.8) → tampilkan konflik.
  - 422 validasi → buka kembali draf dengan pesan dari peladen.

### 7.6 Waktu dan GPS saat mengisi, bukan saat terkirim

- Disimpan: `scannedAtDevice`, `gpsCapturedAt`, `answeredAt` per butir, `takenAtDevice` per foto, `submittedAtDevice`, `receivedAt` (peladen).
- Jam perangkat bisa diputar. Mitigasi: setiap kali daring, klien mencatat `serverClockOffsetMs = serverNow − deviceNow`
  (dari header `Date` atau endpoint `/api/time`). Klien juga menyimpan `performance.timeOrigin + performance.now()` (monoton)
  saat pindai dan kirim, sehingga durasi pengisian tidak terpengaruh perubahan jam di tengah jalan.
- **Waktu resmi** `inspected_at`:
  - Dikirim daring (selisih `receivedAt − submittedAtDevice` terkoreksi offset < 2 menit) → `receivedAt` (sama dengan perilaku sekarang).
  - Dikirim lewat antrean → `submittedAtDevice + offset terakhir yang diketahui`, dibatasi tidak boleh di masa depan dan tidak boleh lebih awal dari 7 hari sebelum `receivedAt`; `offline = true`, `clock_skew_s` disimpan.
  - `durasi_detik` = selisih monoton pindai → kirim. Aturan < 45 detik tetap berlaku.
- Penandaan baru untuk antrean tinjauan: `inspected_at` vs `receivedAt` > 24 jam, atau selisih jam perangkat > 5 menit, menambah status tinjauan "waktu perlu dicek" (tidak menolak).
- Jadwal (`tandaiSelesai`) dan tenggat temuan memakai `inspected_at` resmi, sehingga inspeksi yang dikerjakan tanggal 30 tetapi terkirim tanggal 2 tetap tercatat tepat waktu.

### 7.7 Validasi QR saat luring: cache token per inspektur

Pilihan dan konsekuensinya:

| Opsi | Cara | Keamanan | Kegunaan |
|---|---|---|---|
| A. Tanpa cache | QR wajib daring | sama seperti sekarang | inspeksi tidak bisa dimulai tanpa sinyal: **tidak memenuhi** kebutuhan |
| B. Cache token mentah | perangkat menyimpan token semua aset | **lemah**: siapa pun dengan akses ke ponsel/DevTools bisa membaca semua token dan "memindai" dari kantin | penuh |
| C. **Cache hash token** (usulan) | perangkat menyimpan `HMAC-SHA256(token, kunciPerangkat)` per aset; kunci dibuat peladen per sesi perangkat dan disimpan non-extractable via WebCrypto | token tidak bisa dibaca dari cache; yang bocor hanya hash yang tak berguna di perangkat lain | penuh untuk aset yang sudah di-cache |
| D. Terima apa saja, verifikasi nanti | perangkat menyimpan token yang dipindai, peladen memverifikasi saat sinkron | token tetap harus dipindai fisik; tidak ada data rahasia di perangkat | penuh, tetapi kesalahan baru ketahuan setelah sinkron |

**Usulan: C + D.** Perangkat menyimpan HMAC token untuk mencocokkan aset secara lokal (supaya tahu aset
mana dan checklist apa), **dan** menyimpan token yang benar-benar dipindai di draf. Saat sinkron, peladen
memverifikasi token mentah terhadap `assets.qr_token` (bukan hash) dan mengisi `qr_verified`.

Konsekuensi keamanan yang harus diterima pemilik:
- Bukti kehadiran tetap bergantung pada pemindaian stiker fisik; cache tidak memuat token yang bisa dipakai ulang.
- Foto stiker yang beredar tetap berbahaya sama seperti sekarang (mitigasi: Ganti token).
- Perangkat yang dicuri dalam keadaan masuk bisa membuat draf palsu hanya bila pencuri juga memindai stiker asli.
- Kunci HMAC dicabut saat keluar, saat admin menonaktifkan akun, atau saat sesi kedaluwarsa.
- Inspeksi `qr_verification = 'offline_cache'` diberi lencana kecil di panel; tidak otomatis masuk antrean tinjauan.

### 7.8 Aturan konflik

| Situasi saat sinkron | Penanganan |
|---|---|
| Inspeksi sudah final di peladen (kiriman ganda) | 200, hasil yang ada; antrean ditandai terkirim |
| Draf yang sama diubah dari dua perangkat (inspektur sama) | jarang; peladen menerima `finalize` pertama, yang kedua dapat 200 tanpa perubahan dan klien menampilkan "Sudah dikirim dari perangkat lain" |
| Dua inspektur memeriksa aset yang sama di bulan yang sama | keduanya diterima (sekarang juga boleh); laporan memakai inspeksi final **terakhir** menurut `inspected_at` resmi; jadwal menunjuk yang terakhir |
| Aset dinonaktifkan setelah draf dibuat luring | diterima dengan penandaan "aset nonaktif saat diterima" untuk tinjauan; tidak ditolak (bukti lapangan nyata) {{Asumsi}} |
| Token diganti setelah pemindaian luring | token lama tetap diterima bila `scannedAtDevice` (terkoreksi) < `qr_token_rotated_at`, selain itu `qr_verified = false` dan masuk antrean tinjauan |
| Butir checklist berubah (versi checklist berbeda) | peladen menerima jawaban untuk butir yang masih ada; butir wajib baru yang tidak dijawab → 422, draf dibuka kembali dengan butir baru |
| Akun dinonaktifkan | 401/403; antrean dibiarkan di perangkat, admin bisa meminta inspektur menyerahkannya (ekspor JSON) {{Asumsi}} |
| Pengguna lain masuk di perangkat yang sama | basis data IndexedDB dipisah per `userId`; antrean akun lain tidak terlihat dan tidak terkirim atas nama akun baru |

### 7.9 Yang ditampilkan UI

- **Indikator koneksi** di kepala: "Daring" / "Luring, data disimpan di perangkat".
- Di setiap butir: "Tersimpan di perangkat" (langsung), lalu ✓ kecil "terkirim" setelah sinkron bila draf daring.
- Beranda inspektur memiliki tiga bagian:
  - **Draf** (belum dikirim oleh inspektur).
  - **Antrean** (sudah ditekan Kirim, belum diterima peladen): per item kode aset, waktu kirim, status ("menunggu sinyal", "mengirim foto 2/3", "gagal, coba lagi 30 dtk", "perlu tindakan"), tombol "Kirim sekarang".
  - **Terkirim** (diterima peladen, 30 hari terakhir), dengan waktu resmi dan kesimpulan.
- Lencana jumlah antrean pada ikon aplikasi (`navigator.setAppBadge` bila ada) dan di tombol beranda.
- Peringatan sebelum keluar bila antrean tidak kosong: "Ada {n} inspeksi belum terkirim. Keluar akan menghapusnya dari perangkat ini." dengan pilihan batal.
- Daftar "Belum diperiksa bulan ini" dihitung dari cache + antrean lokal + data peladen terakhir.

### 7.10 Privasi dan pembersihan

- Keluar: kosongkan IndexedDB akun itu setelah konfirmasi (antrean kosong atau pengguna setuju), hapus kunci HMAC dan cache halaman berautentikasi.
- Foto dihapus dari perangkat setelah `finalize` diterima. Draf yang dibuang menghapus fotonya.
- Tidak ada token mentah di cache selain token yang dipindai sendiri dan masih di antrean.

### 7.11 Kontrak API minimal

```
POST   /api/auth/login                {nip, password}                → sesi (cookie httpOnly)
GET    /api/field/bundle              → {assets[], checklists[], hmacKey(wrapped), serverTime, version}
POST   /api/inspections/start         {inspectionId, token, scannedAtDevice}         (daring)
PUT    /api/inspections/{id}/photos/{photoId}   body JPEG, header X-Sha256, X-Taken-At
DELETE /api/inspections/{id}/photos/{photoId}
POST   /api/inspections/{id}/finalize {assetId, token, qrVerification, scannedAtDevice, submittedAtDevice,
                                       monoDurationMs, gps{lat,lng,accuracy,capturedAt}?, answers[], photoIds[],
                                       kesimpulan, catatan?, rekomendasi?, deviceClockOffsetMs}
DELETE /api/inspections/{id}          (buang draf yang sudah pernah dibuat di peladen)
GET    /api/time                      → {now}
```

Semua POST/PUT/DELETE membawa `Idempotency-Key`. `finalize` menjalankan validasi §3.3–§3.7 dalam satu transaksi
(dengan `SELECT … FOR UPDATE` pada baris inspeksi untuk menolak finalisasi bersamaan).

---

## 8. Rencana migrasi data

Sumber: aplikasi live di **tc-vps**, direktori `/home/ubuntu/pal-k3` (bind mount `/root/data/disk/pal-k3`)
(`scripts/deploy_demo.sh:13,30`), basis data `database/database.sqlite`, foto di `storage/app/public/inspeksi/{id}/*.jpg`.
**Dokumen ini tidak menyentuh tc-vps.** Semua langkah di bawah dijalankan pemilik atau atas persetujuannya.

### 8.1 Langkah

1. **Bekukan penulisan** (jendela pemeliharaan; `php artisan down` dengan pesan Indonesia) supaya tidak ada inspeksi yang tertinggal.
2. **Ambil salinan konsisten** di tc-vps (cara sama dengan `scripts/deploy_demo.sh:46-50`):
   `sqlite3 database/database.sqlite ".backup /tmp/pal-k3-ekspor.sqlite"`, cek `PRAGMA integrity_check`,
   `tar -czf /tmp/pal-k3-foto.tar.gz -C storage/app/public inspeksi`. Salin ke mesin kerja lewat Tailscale (`scp`), jangan lewat layanan publik.
3. **Audit sebelum migrasi** (baca saja): hitung baris per tabel; cari nilai di luar enum v2
   (`status ∉ {draf, final}`, `gate_status ∉ 6 nilai`, `role ∉ 3 nilai`, `severity`, `issues.status`, `answer_type`);
   foto yatim (berkas tanpa baris, baris tanpa berkas); `nilai` > 32 karakter; draf lama.
4. **Jalankan skrip migrasi** (TypeScript, `scripts/migrate-from-laravel.ts` di repo v2) ke basis data Postgres staging.
5. **Verifikasi** (§8.4), lalu ulang ke produksi.
6. **Alihkan DNS / tunnel** ke v2. Stiker tidak perlu dicetak ulang karena `qr_token` dan rute `/i/{token}` dipertahankan.
7. Simpan arsip SQLite + foto lama minimal 1 tahun (rantai bukti audit).

### 8.2 Kerangka skrip

```ts
// scripts/migrate-from-laravel.ts  (dijalankan: tsx scripts/migrate-from-laravel.ts --sqlite ./pal-k3-ekspor.sqlite --photos ./inspeksi --dry-run)
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/node-postgres';
import { v5 as uuidv5 } from 'uuid';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import * as s from '../db/schema';

const NS = process.env.PAL_K3_UUID_NS!; // UUID tetap milik proyek, dibuat sekali lalu disimpan
const lama = new Database(argv.sqlite, { readonly: true });
const db = drizzle(process.env.DATABASE_URL!);
const zona = (t: string | null) => (t ? new Date(t.replace(' ', 'T') + '+07:00') : null); // SQLite menyimpan waktu lokal WIB

await db.transaction(async (tx) => {
  // 1. Data induk, id dipertahankan (bigserial disetel ulang setelahnya)
  copy(tx, s.divisions, lama.prepare('select * from divisions').all());
  copy(tx, s.assetTypes, ...);
  copy(tx, s.users, rows.map(u => ({
    ...u,
    role: u.role === 'supervisor' ? 'pemantau' : u.role,
    passwordHash: isBcrypt(u.password) ? u.password : await hash(u.password), // akun demo teks biasa
    isDemo: ['admin', 'pemantau', 'inspektur'].includes(u.nip) && !isBcrypt(u.password),
  })));
  copy(tx, s.assets, rows.map(a => ({ ...a, attributes: JSON.parse(a.attributes ?? 'null') /* qr_token apa adanya */ })));
  copy(tx, s.checklistGroups, ...); copy(tx, s.checklistItems, ...);

  // 2. Inspeksi: id lama → UUIDv5 deterministik
  const idBaru = (n: number) => uuidv5(`inspection:${n}`, NS);
  for (const i of lama.prepare('select * from inspections').all()) {
    await tx.insert(s.inspections).values({
      id: idBaru(i.id), legacyId: i.id,
      status: ({ draft: 'draf', terkirim: 'final' } as any)[i.status] ?? i.status,
      gateStatus: i.gate_status === 'lolos' ? 'sesuai' : i.gate_status,
      inspectedAt: zona(i.inspected_at), receivedAt: zona(i.inspected_at),
      mulaiPada: zona(i.mulai_pada), submittedAtDevice: zona(i.device_time), offline: false,
      qrVerification: i.qr_verified ? 'online' : null, /* kolom lain 1:1 */
    });
  }
  // 3. Jawaban (UUIDv5 dari id lama), temuan, jadwal: FK inspeksi lewat idBaru()
  // 4. Foto: baca berkas, hitung sha256 + ukuran, unggah ke object storage privat
  for (const f of lama.prepare('select * from inspection_photos').all()) {
    const buf = await readFile(join(argv.photos, f.path.replace(/^inspeksi\//, '')));
    const meta = await sharp(buf).metadata();
    const key = `inspeksi/${idBaru(f.inspection_id)}/${uuidv5(`photo:${f.id}`, NS)}.jpg`;
    await storage.put(key, buf, { contentType: 'image/jpeg' });           // idempoten: lewati bila sudah ada dengan sha sama
    await tx.insert(s.inspectionPhotos).values({ id: uuidv5(`photo:${f.id}`, NS), inspectionId: idBaru(f.inspection_id),
      storageKey: key, sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length,
      width: meta.width, height: meta.height, uploadedAt: zona(f.taken_at), takenAtDevice: null, lat: f.lat, lng: f.lng });
  }
  // 5. Setel ulang sequence bigserial ke max(id)+1
  if (argv.dryRun) throw new Rollback();
});
```

Sifat yang wajib: **dapat diulang** (UUIDv5 + upsert, unggahan foto dilewati bila hash sama), **dry-run**
sebagai bawaan, tidak pernah menulis ke SQLite sumber, log ringkas per tabel.

### 8.3 Hal yang perlu diputuskan pemilik

- Draf yang belum terkirim di data lama: ikut dimigrasikan (status `draf`) atau dibuang? Usul: dimigrasikan, tetap terlihat di beranda inspektur.
- Zona waktu kolom SQLite: kode lama menyimpan waktu lokal Asia/Jakarta {{Belum diverifikasi}} (bergantung `APP_TIMEZONE` di `.env` tc-vps). Cek satu baris yang waktunya diketahui sebelum migrasi.
- Akun demo dibawa ke produksi v2 atau tidak.
- Sandi: hash bcrypt `$2y$` dapat diverifikasi di Node (`bcryptjs` menerima `$2y$`) {{Belum diverifikasi}} untuk pustaka yang dipilih; bila tidak, paksa ganti sandi lewat aksi admin.

### 8.4 Verifikasi setelah migrasi

- Jumlah baris per tabel sama (kecuali tabel Laravel internal).
- Setiap `assets.qr_token` sama persis; uji pindai 3 stiker fisik di v2.
- Jumlah foto = jumlah baris; semua `sha256` cocok dengan berkas sumber; tidak ada foto yatim.
- Lembar PMS bulan terakhir dari v2 dibandingkan dengan PDF Laravel untuk bulan yang sama (simbol, kesimpulan, petugas, ringkasan identik).
- Kepatuhan dasbor, antrean tinjauan, dan jumlah temuan terbuka sama dengan aplikasi lama.
- Login sampel tiap peran dengan sandi lama.

---

## 9. Lampiran: daftar celah yang ditemukan

| # | Celah | Rujukan | Usul v2 |
|---|---|---|---|
| 1 | Admin/pemantau tidak bisa melihat foto bukti | `app/Filament` tanpa `photos` | galeri foto di detail inspeksi |
| 2 | Foto di disk publik | `PhotoStore.php:25` | storage privat + URL bertanda tangan |
| 3 | Pemantau dapat membuka lembar stiker (token) | `PastikanPengelola.php:24`, `lembar.blade.php:194` | batasi ke admin (keputusan pemilik) |
| 4 | Halaman Temuan scaffold (id angka, teks bebas) | `IssueResource.php:34-103` | formulir terkontrol, transisi, PIC, audit |
| 5 | Status `proses` tidak punya alur | `Dasbor.php:100-111` | transisi eksplisit |
| 6 | Jadwal hanya dibuat saat inspeksi final | `Schedule.php:44-55` | buat di awal periode (cron) |
| 7 | Filter jatuh tempo memakai 30 hari tetap + fungsi SQLite | `AssetResource.php:228-233` | pakai `periode_hari` |
| 8 | "Perlu tinjauan" laporan ≠ antrean | `LaporanController.php:195` | samakan |
| 9 | Laporan lama memakai daftar aset hari ini | `LaporanController.php:134-140` | aset aktif pada periode itu atau yang punya inspeksi |
| 10 | Default `status = 'draft'` vs kode `draf` | `..._100006:35` | enum tunggal |
| 11 | `nilai` 32 karakter vs validasi 120 | `..._100007:18`, `InspeksiController.php:192` | `text` |
| 12 | Tidak ada batas jumlah foto | `InspeksiController.php:236-261` | maks 6 |
| 13 | Tidak ada unik "satu draf per aset per inspektur" di DB | `InspeksiController.php:84-95` | indeks unik parsial |
| 14 | Draf tanpa umur maksimum | `BerandaController.php:47-52` | kedaluwarsa / pengingat |
| 15 | Butir checklist: tanpa editor opsi/severity_map | `ChecklistItemResource.php:38-57` | editor terkontrol |
| 16 | Tanpa jejak audit perubahan data | | tabel audit |
| 17 | Mode demo menyimpan sandi teks biasa | `User.php:78-85`, `DemoUserProvider.php` | hash juga untuk demo |
| 18 | Tidak bisa luring | `isi.blade.php:379-403` | §7 |
| 19 | Februari: `jatuh_tempo` = 1 Feb + 29 hari jatuh di Maret | `Schedule.php:53` | `min(periode + n − 1, akhir bulan)` (keputusan pemilik) |
