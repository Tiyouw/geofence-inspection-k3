# PAL-K3 v2: Daftar Uji Penerimaan

Sumber kebenaran: kriteria penerimaan **AC-1..AC-29** di catatan *User Stories and Acceptance
Criteria* (enowX 4115716cf8ad), ditambah butir **P** dari audit 19 Nov 2026 (catatan 89409004aa32)
dan permintaan pemilik di hari yang sama. Aturan rilis: semua AC berprioritas Must lulus.

Kolom **Uji otomatis** menunjuk spec yang menyandikan aturannya. Spec ini berjalan di CI:
- E2E Playwright di `next/e2e/`;
- unit/integrasi Vitest di `next/src/**`. Integrasi DB berjalan dengan Postgres di job `check` sejak 19 Nov 2026.

**Cek manual** menunjuk bagian catatan *PAL-K3 v2 — Cek manual* (98b77437594d) untuk hal yang butuh
ponsel, kamera, atau GPS sungguhan.

Bagian **A–O** di bawah adalah daftar paritas Laravel lama, disimpan sebagai arsip karena kode masih
merujuk ID-nya (mis. B5, J1, K5). Butir arsip yang bertentangan dengan keputusan v2 ditandai
**Diganti** dan tidak berlaku.

## AC v2 (berlaku)

### Inspeksi aset bertitik tetap

| AC | Kriteria (ringkas) | Uji otomatis | Cek manual |
|---|---|---|---|
| AC-1 | Aset unit lain: pesan nama unit pemilik, formulir tidak terbuka, API 403 | `e2e/unit.spec.ts` | §3 Inspektur "Lingkup unit" |
| AC-2 | Kamera belakang di Android Chrome; kode stiker yang diketik membuka formulir yang sama | `e2e/petugas/pemindai.spec.ts` | §3 Inspektur "Pindai", "Kode manual" |
| AC-3 | Tanpa pilih berkas/galeri; foto hanya lewat kamera terpandu | `e2e/petugas/kamera.spec.ts` | §3 "Kamera terpandu" |
| AC-4 | Langkah foto kosong → pesan per langkah, tetap draf | `e2e/petugas/kamera.spec.ts` (kirim tanpa foto) | |
| AC-5 | Dalam poligon gedung → "Lokasi sesuai", final | `e2e/petugas/gerbang.spec.ts`; `src/lib/geo/__tests__/gerbang.test.ts` | §4 titik A |
| AC-6 | Dalam kawasan, luar gedung → final "Perlu tinjauan", masuk antrean | `e2e/petugas/gerbang.spec.ts` | §4 titik C |
| AC-7 | Luar kawasan (akurasi ≤ 100 m): Kirim nonaktif dengan alasan; peladen tetap menolak 422, tetap draf, audit `inspeksi.ditolak_lokasi` | `e2e/petugas/gerbang.spec.ts` | §4 titik D |
| AC-8 | Lokasi mati/izin ditolak: Kirim nonaktif, pesan + Coba lagi | `e2e/petugas/gerbang.spec.ts` | §4 titik F |
| AC-8a | Akurasi 150 m: penjelasan sinyal lemah; Kirim sekarang → "Perlu tinjauan" GPS lemah, akurasi tersimpan | `e2e/petugas/gerbang.spec.ts` | §4 titik E |
| AC-8b | Kamera terpandu per langkah; beberapa jepretan; unggah setelah langkah terakhir; tautan ke butir | `e2e/petugas/kamera.spec.ts` | |
| AC-8c | Foto "Isi kotak P3K terbuka" tampil di butir isi 4–24 | `e2e/petugas/p3k.spec.ts` | |
| AC-9 | Area terbatas: tanpa foto, berlabel "Area terbatas" di daftar/detail/laporan | `e2e/petugas/kamera.spec.ts` (area terbatas); `e2e/pemantau/tinjauan.spec.ts` | §3 "Area terbatas" |
| AC-10 | Setelah final, ubah jawaban/foto/lokasi lewat API → "Inspeksi sudah dikirim." | `e2e/petugas/api.spec.ts` | |
| AC-11 | "Tekanan manometer: Kurang" → temuan berat + tindakan; usulan Tidak layak pakai | `e2e/petugas/alur.spec.ts` | |
| AC-12 | Kirim luring → antrean → terkirim saat sinyal kembali, gerbang memakai GPS saat mengisi, tanpa ganda | `e2e/petugas/alur.spec.ts` (luring); `e2e/petugas/api.spec.ts` (idempotensi); `src/features/inspeksi/client/__tests__/outbox.test.ts` | §3 "Luring" |

Catatan AC-7: sejak audit 19 Nov 2026 (S6), jejak audit penolakan menyimpan akurasi dan jarak ke
kawasan, **tanpa koordinat** (denah rahasia). Catatan User Stories masih berbunyi "dengan koordinat":
{{Assumption}} keputusan ini menunggu konfirmasi pemilik.

### Inspeksi kotak P3K

| AC | Kriteria (ringkas) | Uji otomatis | Cek manual |
|---|---|---|---|
| AC-13 | Baku per tipe kotak (B: kasa steril 40) | `src/lib/domain/__tests__/modul.test.ts`; `e2e/petugas/p3k.spec.ts` | §3 "P3K" |
| AC-14 | Kurang dari baku → temuan sedang "x dari y" | `e2e/petugas/p3k.spec.ts` | |
| AC-15 | "Ada yang kedaluwarsa" → temuan sedang | `e2e/petugas/p3k.spec.ts` | |
| AC-16 | Isi berkedaluwarsa wajib tanggal; ≤ 30 hari → catatan tanpa temuan | `e2e/petugas/p3k.spec.ts` | |
| AC-17 | Rekap isi P3K: isi kurang dan kedaluwarsa per kotak | `e2e/pemantau/modul.spec.ts` | §3 Admin "Laporan" |

### Inspeksi mobil pemadam

| AC | Kriteria (ringkas) | Uji otomatis | Cek manual |
|---|---|---|---|
| AC-18 | Dari titik mana pun, "Tidak berlaku (objek bergerak)", tanpa antrean tinjauan | `e2e/petugas/damkar.spec.ts` | §4 "Mobil pemadam di titik D" |
| AC-19 | Odometer angka, tidak pernah temuan | `e2e/petugas/damkar.spec.ts` | |
| AC-20 | Jadwal mobil pemadam per 7 hari (minggu Senin–Minggu WIB) | `e2e/petugas/damkar.spec.ts`; `src/features/dasbor/progres.db.test.ts` | |

### Tinjauan

| AC | Kriteria (ringkas) | Uji otomatis | Cek manual |
|---|---|---|---|
| AC-21 | Antrean "Perlu tinjauan" dan "Area terbatas" dengan foto per butir, peta, poligon, jarak | `e2e/admin/tinjauan.spec.ts`; `e2e/pemantau/tinjauan.spec.ts` | §3 Admin "Tinjauan" |
| AC-22 | Diterima/Ditolak dengan catatan ≥ 10 karakter; nama, waktu, audit; isi inspeksi tetap | `e2e/admin/tinjauan.spec.ts`; `otorisasi.db.test.ts` | |
| AC-23 | Inspektur 403; tinjauan kedua 409; keluar dari antrean kedua peran | `otorisasi.db.test.ts`; `e2e/admin/realtime.spec.ts` | |

### Progres dan laporan

| AC | Kriteria (ringkas) | Uji otomatis | Cek manual |
|---|---|---|---|
| AC-24 | Dasbor % per gedung per modul = laporan Progres per gedung | `src/features/dasbor/progres.db.test.ts`; `e2e/pemantau/progres.spec.ts` | |
| AC-25 | PDF PMS, Rekap temuan, Kartu kontrol, Progres, Rekap isi P3K: Admin dan Pemantau ya, Inspektur 403 | `e2e/pemantau/pemantau.spec.ts`; `e2e/pemantau/modul.spec.ts`; `e2e/pemantau/progres.spec.ts` | |
| AC-26 | Tidak ada nama, logo, foto, atau video perusahaan di PDF/halaman | `e2e/publik/landing.spec.ts` (halaman); PDF belum diuji otomatis | §3 Admin "Laporan" (periksa kop PDF) |

### Pengelolaan area

| AC | Kriteria (ringkas) | Uji otomatis | Cek manual |
|---|---|---|---|
| AC-27 | Gambar/sunting/simpan poligon; garis bersilangan ditolak "Poligon tidak sah: garis saling memotong." | `e2e/admin/lokasi.spec.ts`; `src/lib/geo/__tests__/impor.test.ts` | §2 |
| AC-28 | Tanpa kawasan disetujui gerbang tidak menolak; aset tanpa area → "Perlu tinjauan" | `src/lib/geo/__tests__/gerbang.test.ts`; `e2e/akhir/kawasan.spec.ts` | |
| AC-29 | Tanda area terbatas berlaku untuk semua aset di area itu; perubahan tercatat di audit | `e2e/petugas/kamera.spec.ts`; `e2e/admin/lokasi.spec.ts`; `e2e/admin/audit.spec.ts` | §2 "Area terbatas" |

## P. Privasi, peta, dan keamanan data (audit 19 Nov 2026)

| # | Kriteria | Uji otomatis |
|---|---|---|
| P1 | Koordinat mentah tidak tampil di halaman tinjauan/inspeksi, daftar aset, cap foto, atau PDF kecuali pengaturan admin `foto.cap_koordinat` menyala (bawaan mati) | `e2e/admin/tinjauan.spec.ts`; `src/lib/foto/__tests__/cap.test.ts` |
| P2 | Jejak audit tidak menyimpan koordinat atau bentuk poligon; perubahan titik tercatat sebagai "titik di peta" | `src/features/admin/lib/tanpa-koordinat.test.ts`; `src/features/admin/lib/audit.test.ts`; `e2e/petugas/gerbang.spec.ts` |
| P3 | Tidak ada "PT PAL"/nama perusahaan di UI, PDF, manifest | `e2e/publik/landing.spec.ts` |
| P4 | Semua peta (Lokasi, Ringkasan, tinjauan, aset) terbuka pas di kawasan disetujui; zoom minimum mencegah kembali ke tampilan kota | `e2e/admin/peta-kawasan.spec.ts` |
| P5 | Lokasi: kawasan terpilih tidak menelan klik gedung di dalamnya; lepas pilihan dengan klik ulang, peta kosong, Esc, atau Tutup; pilih dari daftar tetap bisa | `e2e/admin/peta-kawasan.spec.ts`; `src/lib/geo/__tests__/bingkai.test.ts` |
| P6 | Halaman Lokasi tidak meluap di layar ponsel (412 px) | `e2e/admin/peta-kawasan.spec.ts` |
| P7 | Seed ulang tidak mengubah aset, sandi, atau akun yang sudah ada | `src/db/seed/seed.db.test.ts` |

---

# Arsip: daftar paritas Laravel (tidak lagi menjadi aturan rilis)

## A. Masuk dan peran

| # | Uji | Jenis | Asal |
|---|---|---|---|
| A1 | ☐ Inspektur masuk di `/masuk` dengan NIP + sandi → beranda petugas | E | `AdminPanelSmokeTest`, §1.2 |
| A2 | ☐ Admin/pemantau masuk di `/masuk` → dialihkan ke panel | E | `AuthController.php:77-80` |
| A3 | ☐ Inspektur yang masuk di pintu panel ditolak | I | `RedesainPanelTest::test_login_panel_memakai_nip...` |
| A4 | ☐ Akun nonaktif ditolak di kedua pintu dengan pesan gabungan yang tidak membocorkan keberadaan NIP | I | `AdminPanelSmokeTest::admin_nonaktif_ditolak`, §1.2 |
| A5 | ☐ 5 kali gagal untuk NIP+IP yang sama → terkunci 60 detik dengan pesan sisa detik; berhasil mereset hitungan | I | `AuthController.php:47-71` |
| A6 | ☐ Tamu membuka `/i/{token}` → `/masuk` → setelah masuk kembali ke `/i/{token}` | E | §1.2 |
| A7 | ☐ Keluar menghapus sesi dan kembali ke `/masuk` dengan "Anda sudah keluar." | E | `AuthController.php:85-92` |
| A8 | ☐ Demo aktif: akun `admin`/`pemantau`/`inspektur` masuk dengan sandi demo; halaman masuk menampilkan kredensial | I | `DemoLoginTest` |
| A9 | ☐ Demo mati: sandi demo ditolak dan kredensial tidak tampil | I | `DemoLoginTest::test_mematikan_demo...` |
| A10 | ☐ Akun NIP tetap memakai hash saat demo aktif; seeder demo idempoten dan tidak menyentuh akun NIP/inspeksi/token | I | `DemoLoginTest` |
| A11 | ☐ Admin dapat menerbitkan sandi baru untuk petugas; sandi tampil sekali, tersimpan sebagai hash | I | `SandiPetugas.php` **(baru di UI)** |

## B. Hak akses

| # | Uji | Jenis | Asal |
|---|---|---|---|
| B1 | ☐ Admin/pemantau yang membuka `/petugas/*` dialihkan ke panel; permintaan JSON mendapat 403 | I | `PastikanInspektur.php` |
| B2 | ☐ Inspektur ditolak 403 di `/stiker` dan `/laporan*` dengan pesan yang menjelaskan | I | `HalamanGalatTest`, `TautanSilangPengelolaTest` |
| B3 | ☐ Inspektur tidak bisa membaca/mengubah draf milik inspektur lain (semua endpoint) | I | `InspeksiController.php:447-450` |
| B4 | ☐ Akun panel yang membuka `/i/{token}` tidak membuat draf | I | `AlurLapanganTest::akun_panel_tidak_membuat_draf_saat_membuka_qr` |
| B5 | ☐ Pemantau tidak bisa membuat/mengubah/menghapus di semua sumber data, termasuk lewat panggilan API langsung | I | `OtorisasiPanelTest`, `RedesainPanelTest::test_pemantau_tidak_bisa_memanggil_aksi_tulis_langsung` |
| B6 | ☐ Pemantau tetap bisa melihat daftar aset, inspeksi, temuan; menu Data Induk tersembunyi | I | `OtorisasiPanelTest::test_pemantau_masih_boleh_melihat_daftar_aset` |
| B7 | ☐ Pemantau tidak bisa membuka pengelolaan petugas | I | `UserManagementTest` |
| B8 | ☐ Inspeksi tidak bisa dibuat dari panel, bahkan oleh admin | I | `OtorisasiPanelTest::test_inspeksi_tak_bisa_dibuat...` |
| B9 | ☐ Admin tidak bisa mengubah peran atau menonaktifkan dirinya sendiri; petugas tidak bisa dihapus | I | `UserResource.php` |
| B10 | ☐ (keputusan) Pemantau tidak bisa membuka lembar stiker | I | SPEC §1.4 celah |

## C. Token QR

| # | Uji | Jenis | Asal |
|---|---|---|---|
| C1 | ☐ Aset baru mendapat token `PAL-K3-` + 32 hex, unik, tanpa nomor aset | U | `AssetGateTest::token_qr_acak...`, `SeedIntegrityTest` |
| C2 | ☐ Tidak ada token di repo, seed, fixture; seed ulang tidak mengganti token | I | `SeedIntegrityTest` |
| C3 | ☐ Token tidak muncul di landing, pencarian (judul, rincian, URL), peta dasbor, respons API dasbor | I | `PencarianPanelTest`, `RedesainPanelTest`, `ExampleTest` |
| C4 | ☐ Pemindai menerima URL penuh (host apa pun) atau token mentah; QR lain ditolak dengan pesan | E | `pindai.blade.php:97-145` |
| C5 | ☐ Kode cadangan diketik manual membuka inspeksi; format salah ditolak | E | `pindai.blade.php:220-238` |
| C6 | ☐ Token tak dikenal → "Stiker tidak dikenali"; aset nonaktif → "Aset tidak aktif" | I | `AlurLapanganTest::token_tak_dikenal...` |
| C7 | ☐ "Ganti token" (admin, dengan konfirmasi) mematikan stiker lama; token tidak bisa diubah lewat formulir | I | `AssetResource.php:246-279` |
| C8 | ☐ Token yang dimigrasikan dari Laravel tetap membuka aset yang sama di v2 (uji 3 stiker fisik) | E | SPEC §8.4 |

## D. Formulir dan jawaban

| # | Uji | Jenis | Asal |
|---|---|---|---|
| D1 | ☐ Token sah membuat draf dan membuka formulir; pindai ulang memakai draf yang sama | I | `AlurLapanganTest` |
| D2 | ☐ Formulir menampilkan 10 butir APAR dalam 4 grup sesuai urutan, dengan dasar hukum | E | `SeedIntegrityTest::checklist_apar_*` |
| D3 | ☐ Butir di luar tipe aset ditolak; nilai di luar opsi ditolak; `nilai_angka` pada butir pilihan ditolak; `nilai` pada butir angka ditolak | I | `AlurLapanganTest::jawaban_palsu...` |
| D4 | ☐ Jawaban tersimpan per ketukan; memilih ulang menimpa (satu jawaban per butir) | I | §3.3 |
| D5 | ☐ Usulan kesimpulan: tanpa temuan → layak; ada berat → tidak layak; selain itu → layak dengan catatan | U | `IssueGenerator::usulKesimpulan` |
| D6 | ☐ Tabel severity per tipe jawaban (select via map, dua-nilai `tidak`, angka < baku, teks/tanggal tidak pernah) | U | `InspectionAnswerTest` |
| D7 | ☐ Draf dapat dibuang beserta foto dan jawaban; inspeksi final tidak bisa dibuang | I | `InspeksiController::batal` |
| D8 | ☐ Beranda menampilkan draf yang belum dikirim | I | `AlurLapanganTest::beranda_dan_riwayat_petugas_merender` |

## E. GPS dan gerbang lokasi

| # | Uji | Jenis | Asal |
|---|---|---|---|
| E1 | ☐ Haversine: 0 di titik sama; pergeseran kecil masuk akal; null bila salah satu tanpa koordinat | U | `AssetGateTest` |
| E2 | **Diganti (ADR-7/12, AC-5..8a): gerbang poligon, bukan radius.**  ☐ Radius efektif: override, lalu per jenis lokasi (75/60/30/tanpa), tak dikenal 75 | U | `AssetGateTest::radius_bawaan...` |
| E3 | **Diganti (ADR-7/12, AC-5..8a).**  ☐ Tabel gerbang: di titik/10 m/50 m → sesuai; 200 m → jauh; akurasi 120 → gps_lemah; tanpa koordinat → tanpa_gps; kendaraan → tidak_berlaku | U | `AssetGateTest::evaluasi_gerbang` |
| E4 | **Diganti (ADR-12: kelonggaran = min(akurasi, 30 m)).**  ☐ Akurasi > 100 menang atas jarak; akurasi ditambahkan ke toleransi; `≤ 2×toleransi` → perlu_review | U | `AssetGateTest` |
| E5 | **Diganti (AC-7, AC-8): di luar kawasan dan tanpa posisi tidak bisa dikirim.**  ☐ Semua status gerbang tetap bisa dikirim | I | §3.5 |
| E6 | **Diganti (AC-8): izin ditolak mengunci Kirim.**  ☐ Izin lokasi ditolak tidak mengunci formulir; pesan sesuai | E | `isi.blade.php:340-346` |
| E7 | **Diganti (ADR-9, AC-21): antrean = perlu_tinjauan atau area terbatas.**  ☐ Antrean tinjauan = final ∧ gate ∈ {perlu_review, jauh, gps_lemah, tanpa_gps} ∧ belum ditinjau; sama di menu Inspeksi dan dasbor | I | `DaftarInspeksiTest::test_tinjauan_panel_dan_dasbor_konsisten...` |
| E8 | ☐ Durasi < 45 detik ditandai dan dapat difilter, tidak ditolak | I | `InspectionResource.php:166-175` |

## F. Foto

| # | Uji | Jenis | Asal |
|---|---|---|---|
| F1 | ☐ Tanpa foto tidak bisa kirim (klien dan peladen) | I | `AlurLapanganTest::seluruh_jawaban_tanpa_foto...` |
| F2 | ☐ Hanya JPEG/PNG/WebP ≤ 12 MB; HEIC yang tak bisa didekode ditolak dengan pesan | I | `PhotoStore.php:28-38` |
| F3 | ☐ Hasil: lebar ≤ 1600 px, JPEG mutu ≈ 82, orientasi EXIF dikoreksi, foto kecil tidak diperbesar | U | `PhotoStore.php:63-129` |
| F4 | ☐ Foto inspeksi final tidak bisa dihapus | I | `AlurLapanganTest::inspeksi_final_menolak...` |
| F5 | ☐ (baru) Admin dan pemantau melihat foto di detail inspeksi; URL foto tidak bisa dibuka tanpa sesi | E | SPEC §3.6 celah |
| F6 | **Diganti (ADR-8): maks 5 foto per langkah kamera terpandu.**  ☐ (baru) Maksimum 6 foto per inspeksi | I | SPEC §7.4 |

## G. Finalisasi, temuan, jadwal

| # | Uji | Jenis | Asal |
|---|---|---|---|
| G1 | ☐ Butir wajib kosong → pesan berisi label butir; input dipertahankan | I | `InspeksiController.php:305-311` |
| G2 | ☐ Temuan berat + kesimpulan `layak` ditolak; ada temuan + rekomendasi kosong ditolak | I | `AlurLapanganTest::temuan_berat_tidak_bisa...` |
| G3 | ☐ APAR baik → final, 0 temuan; APAR dengan 1 temuan berat → 1 temuan | I | `AlurLapanganTest::pemeriksaan_lengkap...` |
| G4 | ☐ Waktu resmi daring = waktu peladen, bukan `device_time` | I | idem |
| G5 | ☐ Kirim ulang inspeksi final idempoten, tidak menggandakan/menyetel ulang temuan | I | idem |
| G6 | ☐ Final mengisi `terakhir_dicek`, `durasi_detik`, dan menandai jadwal | I | idem |
| G7 | ☐ Final menolak perubahan lokasi, jawaban, foto | I | `AlurLapanganTest::inspeksi_final_menolak...` |
| G8 | ☐ Kalimat temuan: select "label: pilihan"; angka "label: n dari baku satuan, kurang k"; dua-nilai "label: Tidak ada/Tidak baik/Tidak berfungsi" | U | `IssueGenerator.php:81-106` |
| G9 | ☐ Tenggat temuan: berat 3, sedang 14, ringan 30 hari dari tanggal inspeksi; tindakan baku sesuai tingkat | U | `IssueGenerator.php:25-35` |
| G10 | ☐ Jadwal: satu baris per aset per bulan; pemeriksaan ulang memakai baris yang sama; `selesai` bila ≤ akhir hari tenggat, `telat` setelahnya; label Belum/Terlewat/Terlaksana/Terlaksana (telat) | I | `AlurLapanganTest::jadwal_*`, `pemeriksaan_ulang...` |
| G11 | ☐ Membuka dasbor tidak menulis jadwal | I | `RedesainPanelTest::test_dasbor_kosong...` |
| G12 | ☐ Beranda menampilkan sisa hari dan banner tenggat terlewat | I | `AlurLapanganTest::beranda_menandai_urgensi...` |
| G13 | ☐ Dua finalisasi bersamaan pada inspeksi yang sama menghasilkan satu set temuan | I | `plan.md` Tahap 1 **(baru)** |
| G14 | ☐ (baru) Jadwal dibuat di awal periode untuk semua aset aktif; bulan terlewat tercatat | I | SPEC §3.9 celah |

## H. Panel admin

| # | Uji | Jenis | Asal |
|---|---|---|---|
| H1 | ☐ Setiap daftar dan formulir buat sumber data merender | E | `AdminPanelSmokeTest` |
| H2 | **Diganti (ADR-12): radius tidak dipakai gerbang.**  ☐ Formulir aset: validasi lat/lng/radius, jenis lokasi menampilkan radius bawaan, terakhir dicek baca saja | E | `AssetResource.php:46-145` |
| H3 | **Diganti sebagian: kolom radius tidak dipakai.**  ☐ Tabel aset: radius efektif bawaan/khusus/tanpa gerbang; filter tipe, gedung, jenis lokasi, aktif, tanpa koordinat (tetap menghormati filter lain), jatuh tempo | I | `AssetFiltersTest` |
| H4 | ☐ Label lantai/lokasi sesuai 7 kasus | U | `LabelLokasiAsetTest` |
| H5 | ☐ Detail inspeksi: bukti lapangan tidak dapat diubah; hanya catatan tinjauan | I | `InspectionResource.php:81-114` |
| H6 | **Diganti (ADR-9, AC-22): Admin K3 dan Pemantau meninjau, Diterima/Ditolak.**  ☐ Tandai ditinjau: hanya admin, alasan ≥ 10 karakter, menyimpan peninjau dan waktu, GPS tidak berubah | I | `RedesainPanelTest::test_tinjauan_memerlukan_alasan...` |
| H7 | ☐ Tab Inspeksi: Antre ditinjau (bawaan bila ada), Lokasi menyimpang, Tidak layak pakai, Semua; lencana menu = jumlah antrean | I | `DaftarInspeksiTest` |
| H8 | ☐ Petugas: buat → bisa masuk; ubah tanpa sandi mempertahankan sandi; nonaktif → tidak bisa masuk | I | `UserManagementTest` |
| H9 | ☐ (baru) Formulir temuan memakai pilihan terkontrol (aset berdasarkan kode, tingkat, status) dan mencatat jejak audit | I | SPEC §3.8 celah |

## I. Dasbor

| # | Uji | Jenis | Asal |
|---|---|---|---|
| I1 | ☐ Kepatuhan menghitung unit APAR aktif sekali; kondisi dari inspeksi final terakhir bulan ini | I | `RedesainPanelTest::test_kepatuhan...` |
| I2 | ☐ Antrean mengecualikan temuan selesai dan inspeksi yang sudah ditinjau | I | `RedesainPanelTest::test_antrean_mengecualikan...` |
| I3 | ☐ Empat tab (berat, lewat, posisi, belum) dengan paginasi 6; nilai tab lain ditolak | I | `RedesainPanelTest` |
| I4 | ☐ Halaman antrean dikoreksi setelah entri terakhir diproses | I | `RedesainPanelTest::test_halaman_antrean_disesuaikan...` |
| I5 | ☐ Tetapkan tenggat (≥ hari ini) dan Tandai selesai (uraian ≥ 10) hanya untuk admin | I | `RedesainPanelTest::test_admin_menetapkan_tenggat...` |
| I6 | ☐ Peta: semua aset bertitik di dalam kanvas, aset tanpa koordinat dihitung tetapi tidak digambar, satu titik tidak membagi nol, status dan tanda tinjau benar, hanya kolom yang perlu | I | `RedesainPanelTest::test_peta_*` |
| I7 | ☐ Tren 6 bulan menghitung aset unik per bulan | I | `RingkasanDasbor.php:58-62` |

## J. Pemantau

| # | Uji | Jenis | Asal |
|---|---|---|---|
| J1 | ☐ Ringkasan manajemen tampil tanpa antrean dan tanpa aksi tulis; admin tidak melihatnya | I | `RedesainPanelTest::test_pemantau_melihat...`, `test_admin_tidak_melihat...` |
| J2 | ☐ Narasi untuk tiga keadaan (tanpa aset, tanpa inspeksi, normal) | U | `RedesainPanelTest::test_narasi...` |
| J3 | ☐ Risiko: 5 temuan terbuka, berat dulu, lalu tenggat terdekat, tanpa tenggat terakhir | U | `RedesainPanelTest::test_risiko...` |
| J4 | ☐ Tautan unduh PMS, rekap temuan, pilih kartu kontrol berfungsi | E | `dasbor.blade.php` |

## K. Pencarian Ctrl+K

| # | Uji | Jenis | Asal |
|---|---|---|---|
| K1 | ☐ Ctrl+K / Cmd+K membuka; `/` tidak dibajak | E | `PencarianPanelTest::test_halaman_panel_memuat_kolom_cari...` |
| K2 | ☐ Kosong/1 huruf → saran (halaman, tindakan untuk admin, 3 inspeksi final terbaru; tanpa draf); dropdown tidak terbuka sendiri | I | `PencarianPanelTest::test_saran_*`, `test_dropdown...` |
| K3 | ☐ ≥ 2 huruf mencari aset, temuan, inspeksi (kode aset, nama petugas); maks 5 per kelompok | I | `PencarianPanelTest` |
| K4 | ☐ `%` dan `_` diperlakukan sebagai huruf | I | `PencarianPanelTest::test_wildcard...` |
| K5 | ☐ Pemantau: tanpa aset/tindakan/halaman data induk; temuan mengarah ke daftar | I | `PencarianPanelTest::test_pemantau_*` |
| K6 | ☐ Pencarian tidak menulis ke basis data dan tidak pernah mengembalikan token | I | `PencarianPanelTest` |

## L. Laporan dan stiker

| # | Uji | Jenis | Asal |
|---|---|---|---|
| L1 | ☐ PMS: A4 lanskap, kop, judul, matriks per grup, simbol ✓ X O Ø -, baris abu "Belum diperiksa", nomor butir dengan dasar hukum, keterangan simbol, ringkasan, tiga kolom tanda tangan, kaki tiap halaman; cocok dengan `samples/contoh-pms-apar-2026-10.pdf` untuk data yang sama | E | SPEC §4.9 |
| L2 | ☐ Satu inspeksi per aset per periode (yang terakhir); aset tanpa inspeksi tetap tampil | I | `LaporanController.php:150-159` |
| L3 | ☐ Nama berkas `PMS-APAR-2026-10.pdf`, `Rekap-Temuan-2026-10.pdf`, `Kartu-Kontrol-{kode}-{tahun}.pdf` | I | `LaporanController.php` |
| L4 | ☐ Rekap temuan: temuan belum selesai, urut berat → ringan → terlama; tindakan baku bila tindak lanjut kosong; tenggat lewat ditandai | E | `temuan.blade.php` |
| L5 | ☐ Kartu kontrol: identitas aset dan 12 baris bulan dengan tanggal, petugas, kesimpulan, temuan | E | `kartu.blade.php` |
| L6 | ☐ Halaman laporan: filter tipe/tahun (2020..2100)/bulan/gedung; tahun tersedia = tahun berinspeksi + tahun ini | I | `LaporanController.php:102-117,201-210` |
| L7 | ☐ Lembar stiker: tata letak 3x8, 2x5 (bawaan), 2x4 dengan ukuran mm tepat; filter tipe, gedung, lantai, kode dipisah koma; hanya aset aktif; QR berisi URL `/i/{token}` dengan koreksi galat M; token dicetak di bawah QR; navigasi tersembunyi saat cetak | E | `StikerController.php`, `TautanSilangPengelolaTest` |
| L8 | ☐ Format angka/tanggal Indonesia (85,7%, nama bulan Indonesia, "WIB") | U | §6.1 |

## M. Umum

| # | Uji | Jenis | Asal |
|---|---|---|---|
| M1 | ☐ Landing: 4 kartu modul dari data, status siap = aktif ∧ punya checklist; tanpa token/koordinat/emoji; tautan sesuai status masuk | E | `ExampleTest` |
| M2 | ☐ 404/403/419/429/500/503 berbahasa Indonesia dengan jalan pulang sesuai peran | E | `HalamanGalatTest` |
| M3 | ☐ Pesan validasi berbahasa Indonesia dengan nama atribut ramah | I | `lang/id/validation.php` |
| M4 | ☐ Data seed: 4 tipe objek, damkar satu-satunya bergerak, APAR 30 hari, 35 APAR, koordinat bersama untuk lantai berbeda, atribut numerik; seeder idempoten | I | `SeedIntegrityTest` |

## N. Offline (baru)

| # | Uji | Jenis | Asal |
|---|---|---|---|
| N1 | ☐ Setelah sekali masuk daring, aplikasi lapangan terbuka dalam mode pesawat | E | §7.2 |
| N2 | ☐ Pindai stiker sah saat luring membuka formulir; stiker tak dikenal ditolak tanpa membuat draf | E | §7.3, §7.7 |
| N3 | ☐ Cache di perangkat tidak memuat token mentah aset (periksa IndexedDB) | E | §7.7 |
| N4 | ☐ Jawaban, GPS, foto, dan kesimpulan tersimpan di perangkat saat luring dan bertahan setelah muat ulang/ponsel dimulai ulang | E | §7.3 |
| N5 | ☐ Foto dikompresi di klien (≤ 1600 px, JPEG) sebelum disimpan; hash dicek peladen | E/I | §7.4 |
| N6 | ☐ Kirim saat luring → masuk "Antrean"; inspektur bisa lanjut ke tabung berikutnya | E | §7.9 |
| N7 | ☐ Kembali daring → antrean terkirim otomatis (Background Sync di Android, saat dibuka di iOS), pindah ke "Terkirim" | E | §7.5 |
| N8 | ☐ Mengirim operasi yang sama dua kali (Idempotency-Key sama) menghasilkan satu inspeksi, satu set foto, satu set temuan | I | §7.5 |
| N9 | ☐ Idempotency-Key sama dengan isi berbeda → 422 | I | §7.5 |
| N10 | ☐ Backoff: galat jaringan/5xx dicoba ulang dengan jeda bertambah; 401/403/422 tidak dicoba ulang dan menampilkan tindakan | I/E | §7.5 |
| N11 | ☐ `inspected_at` antrean = waktu kirim di perangkat terkoreksi offset; ditandai `offline`; jadwal dan tenggat temuan memakai waktu itu (inspeksi tanggal 30 terkirim tanggal 2 tetap "selesai") | I | §7.6 |
| N12 | ☐ Jam perangkat yang diputar tidak mengubah durasi pengisian; selisih jam besar ditandai untuk tinjauan | I | §7.6 |
| N13 | ☐ GPS yang tersimpan adalah posisi saat mengisi; peladen menghitung ulang gerbang dari nilai mentah | I | §7.3 |
| N14 | ☐ Aturan konflik §7.8: final ganda, dua inspektur satu aset, token diganti setelah pindai luring, butir wajib baru | I | §7.8 |
| N15 | ☐ Pengguna lain masuk di perangkat yang sama tidak melihat dan tidak mengirim antrean pengguna sebelumnya | E | §7.8 |
| N16 | ☐ Keluar dengan antrean berisi meminta konfirmasi; setelah keluar IndexedDB akun itu kosong | E | §7.10 |
| N17 | ☐ Sesi habis saat ada antrean → masuk ulang dengan akun yang sama melanjutkan pengiriman tanpa kehilangan data | E | §7.5 |

## O. Migrasi data

| # | Uji | Jenis | Asal |
|---|---|---|---|
| O1 | ☐ Skrip migrasi berjalan dalam dry-run tanpa galat pada salinan SQLite live | I | §8 |
| O2 | ☐ Jumlah baris per tabel sama; token sama persis; foto lengkap dengan sha256 cocok | I | §8.4 |
| O3 | ☐ Menjalankan ulang skrip tidak menggandakan data | I | §8.2 |
| O4 | ☐ PMS bulan terakhir dari v2 identik isinya dengan PDF Laravel untuk bulan yang sama | E | §8.4 |
| O5 | ☐ Sampel akun tiap peran masuk dengan sandi lama | E | §8.4 |
