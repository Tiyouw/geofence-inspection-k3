# Rencana pengembangan berikutnya — Inspeksi K3 APAR

Tanggal: 26 Oktober 2026  
Repositori: `Tiyouw/pal-k3`  
Dasar peninjauan: branch `pipeline/ui-admin`, commit `5e9c397`  
Status: rencana untuk handoff; belum diimplementasikan.

## 1. Konteks untuk agent penerima

Agent lain sedang menggabungkan branch tersebut ke `main`. Tunggu merge selesai, periksa hasil akhirnya, lalu mulai pekerjaan dari `main` terbaru pada branch/worktree terpisah. Jangan mengubah, melakukan reset, atau mengambil alih branch yang sedang dikerjakan agent tersebut.

Peninjauan awal dilakukan dengan membaca kode dan tes. Tidak ada pengujian baru atau pembuktian eksploitasi terhadap aplikasi produksi. Temuan di bawah harus diverifikasi kembali pada hasil merge; sebagian mungkin sudah diperbaiki oleh agent lain.

Tujuan pengembangan berikutnya: membuat inspeksi lapangan andal, menjaga bukti pemeriksaan, dan memastikan temuan ditangani sampai selesai. Pertahankan pembaruan tampilan, pencarian, dan dasbor yang sudah dikerjakan.

Stack yang ditemukan: Laravel 13.33.0, Filament 3.3.55, Livewire 3.8.9, PHPUnit 12.5.36, SQLite, dompdf, dan simple-qrcode. Konfirmasi kembali versi aktual dengan `composer show --direct` dan berkas dependensi frontend sebelum menggunakan API paket. Periksa versi PHP nyata serta persyaratan paket; jangan hanya mengandalkan README.

Ikuti `AGENTS.md`, aturan `.ai/rules` bila tersedia, dan skill yang relevan. Jangan menambah atau mengganti dependensi tanpa persetujuan. Dokumen ini bukan instruksi untuk langsung menerapkan seluruh roadmap atau melakukan deployment produksi.

## 2. Urutan prioritas

| Tahap | Sasaran | Hasil utama |
| --- | --- | --- |
| 0 | Validasi hasil merge | Baseline `main` dan alur utama terverifikasi |
| 1 | Integritas inspeksi | Inspeksi final terkunci, jawaban sah, finalisasi konsisten |
| 2 | Ketahanan koneksi | Penyimpanan berurutan, retry, dan finalisasi menunggu data |
| 3 | Tindak lanjut temuan | Status terkontrol, PIC, bukti perbaikan, riwayat perubahan |
| 4 | Jadwal dan pengingat | Kewajiban tercatat sebelum pemeriksaan dilakukan |
| 5 | Perlindungan bukti dan operasional | Foto terotorisasi, backup teruji, pemeriksaan PR otomatis |

Milestone pertama yang direkomendasikan: **Inspeksi lapangan andal**, mencakup tahap 0–2. Jika foto produksi harus bersifat internal, majukan pekerjaan akses foto dari tahap 5 ke milestone pertama.

## 3. Tahap 0 — Validasi setelah merge

- [ ] Pastikan merge selesai dan catat commit `main` yang menjadi baseline.
- [ ] Bandingkan temuan dokumen ini dengan kode hasil merge; keluarkan pekerjaan yang sudah selesai.
- [ ] Periksa konfigurasi pengujian agar memakai database terisolasi, bukan database aplikasi aktif.
- [ ] Jalankan suite pengujian yang tersedia dan build frontend di checkout terpisah.
- [ ] Uji alur tiga peran: administrator, inspektur, dan pemantau.
- [ ] Uji login NIP, pencarian panel, dasbor, pemindaian QR, pengisian checklist, foto, finalisasi, tinjauan lokasi, dan laporan PDF.
- [ ] Bedakan kegagalan yang sudah ada pada baseline dari regresi perubahan berikutnya.

Gunakan tes di `tests/Feature` dan `tests/Unit`, serta alur browser yang tersedia di `tests/qa-browser`. Laporan QA lama adalah bahan pembanding, bukan bukti bahwa seluruh temuannya masih berlaku. Contohnya, pembatasan tulis pemantau sudah memiliki trait `HanyaAdminBolehMenulis` dan tes otorisasi.

**Selesai bila:** hasil pemeriksaan baseline tercatat, kegagalan dipahami, dan tidak ada modifikasi pada pekerjaan merge agent lain.

## 4. Tahap 1 — Integritas inspeksi

### Temuan dari kode

- `app/Http/Controllers/Petugas/InspeksiController.php`: `lokasi()` dan `hapusFoto()` memeriksa kepemilikan, tetapi belum memeriksa status final. `simpanJawaban()` dan `unggahFoto()` sudah memiliki pemeriksaan status final.
- `simpanJawaban()` menerima `nilai` sebagai string umum dan `nilai_angka` sebagai angka umum. Validasi belum mengikuti jenis dan opsi tiap checklist.
- `itemWajibBelumTerisi()` menganggap nilai yang bukan `null` sebagai terisi. Perlu memastikan nilai tersebut benar-benar sah untuk tipe itemnya.
- `app/Models/ChecklistItem.php`: nilai yang tidak dikenali dapat menghasilkan tingkat temuan `null`; validasi masukan harus mencegah nilai sembarang masuk ke penilaian.
- `kirim()` sudah membungkus penulisan dalam transaksi, tetapi pemeriksaan status final dan pembacaan data dilakukan sebelum transaksi. Dua request bersamaan perlu diuji.
- `app/Services/IssueGenerator.php`: pembangkitan temuan menghapus lalu membuat ulang temuan inspeksi terkait. Pengiriman ulang tidak boleh menghapus tindak lanjut yang sudah ada.

### Pekerjaan

- [ ] Terapkan penjagaan status secara konsisten pada perubahan lokasi, jawaban, unggah/hapus foto, dan pembatalan inspeksi.
- [ ] Pastikan endpoint tetap memeriksa pemilik dan peran; menyembunyikan tombol saja tidak cukup.
- [ ] Validasi nilai berdasarkan jenis item: pilihan yang diizinkan, angka sesuai aturan domain, tanggal sah, serta teks wajib yang tidak kosong.
- [ ] Pertahankan batasan bahwa item checklist harus milik jenis aset inspeksi tersebut.
- [ ] Validasi ulang keadaan inspeksi saat finalisasi; buat finalisasi aman terhadap retry dan request bersamaan.
- [ ] Pilih mekanisme konkurensi sesuai database aktual. Jangan menganggap `lockForUpdate()` saja memberi perlindungan yang sama pada SQLite dan database lain.
- [ ] Pastikan pembangkitan temuan, pembaruan aset, dan penyelesaian jadwal konsisten jika transaksi gagal.
- [ ] Periksa interaksi perubahan foto/jawaban yang berjalan bersamaan dengan finalisasi.

### Kriteria selesai dan pengujian

- [ ] Request langsung tidak dapat mengubah GPS atau menghapus bukti inspeksi final.
- [ ] Inspektur tidak dapat mengubah inspeksi milik pengguna lain.
- [ ] Jawaban di luar opsi, tipe nilai yang salah, dan item dari jenis aset lain ditolak.
- [ ] Jawaban wajib yang tidak sah tidak dapat meloloskan finalisasi.
- [ ] Retry finalisasi tidak menggandakan hasil atau mereset tindak lanjut temuan.
- [ ] Pengujian request bersamaan benar-benar memakai mekanisme yang dapat memunculkan konkurensi; dua request berurutan tidak cukup sebagai bukti.
- [ ] Kegagalan pembangkitan temuan tidak meninggalkan status final parsial.

## 5. Tahap 2 — Ketahanan koneksi lapangan

### Temuan dari kode

`resources/views/petugas/isi.blade.php` mengirim jawaban lewat `fetch`. Jika gagal, petugas diminta menekan ulang pilihannya. Handler submit belum menunggu seluruh penyimpanan jawaban dan unggahan selesai. Perubahan cepat juga perlu diuji agar respons atau request lama tidak menimpa pilihan terbaru.

### Pekerjaan

- [ ] Buat antrean penyimpanan per item dan pertahankan urutan perubahan.
- [ ] Abaikan respons usang; pastikan nilai terakhir yang dipilih menjadi nilai akhir di server.
- [ ] Tampilkan status yang jelas: menyimpan, tersimpan, menunggu koneksi, atau perlu diperbaiki.
- [ ] Retry otomatis untuk gangguan jaringan dan kegagalan sementara, dengan jeda serta batas percobaan yang wajar.
- [ ] Jangan mengulang tanpa batas untuk validasi gagal, sesi habis, atau akses ditolak. Beri tindakan pemulihan yang jelas.
- [ ] Tunggu penyimpanan jawaban, debounce catatan, dan unggahan foto selesai sebelum finalisasi.
- [ ] Pertahankan input jika finalisasi gagal dan aktifkan kembali kontrol yang diperlukan.
- [ ] Tambahkan draf lokal hanya jika dibutuhkan untuk pemulihan setelah reload; pisahkan per akun dan inspeksi, serta hapus saat logout, pembatalan, atau finalisasi berhasil.

Tidak perlu langsung membangun PWA atau dukungan offline penuh. Mulai dari antrean request yang andal. Jika persistensi lokal ditambahkan, tentukan aturan konflik ketika server sudah berstatus final atau akun berubah.

### Kriteria selesai dan pengujian

- [ ] Putus-sambung koneksi saat mengisi tidak menghilangkan jawaban yang sudah masuk antrean.
- [ ] Memilih jawaban beberapa kali dengan cepat menyimpan pilihan terbaru.
- [ ] Menekan kirim segera setelah mengubah jawaban/catatan tetap mengirim nilai terbaru.
- [ ] Kirim tidak berjalan ketika foto atau jawaban masih gagal disimpan.
- [ ] Sesi habis, akses ditolak, dan kesalahan validasi ditampilkan secara berbeda dari masalah jaringan.
- [ ] Jika draf lokal diterapkan, data pengguna sebelumnya tidak muncul ketika akun berganti.

Gunakan alat browser yang sudah tersedia untuk uji jaringan dan perilaku frontend. Jangan menambahkan framework pengujian baru hanya untuk mengikuti rencana ini.

## 6. Tahap 3 — Pengelolaan temuan

### Kondisi saat ini

`app/Filament/Resources/IssueResource.php` masih memakai ID sebagai label relasi serta kolom teks bebas untuk status dan tingkat keparahan. `app/Models/Issue.php` menyimpan tindakan, target, dan waktu selesai, tetapi belum menyimpan penanggung jawab. Dasbor sudah memiliki tindakan menetapkan tenggat dan menyelesaikan temuan; perlu memakai aturan yang sama dengan halaman resource.

### Pekerjaan

- [ ] Ganti label ID dengan kode aset, lokasi, dan konteks inspeksi yang mudah dibaca.
- [ ] Gunakan status dan tingkat keparahan terkontrol berdasarkan nilai domain yang berlaku; audit data lama sebelum memperketat validasi.
- [ ] Tambahkan PIC dan filter berdasarkan status, tingkat keparahan, area, PIC, serta keterlambatan.
- [ ] Sepakati transisi status, hak menetapkan PIC, dan hak menutup atau membuka kembali temuan.
- [ ] Tambahkan bukti perbaikan dan pencatatan siapa melakukan perubahan, kapan, serta alasannya.
- [ ] Satukan aturan aksi dasbor dan halaman temuan agar hasilnya konsisten.
- [ ] Validasi bahwa aset, inspeksi, dan item checklist yang dipilih saling sesuai.

**Selesai bila:** temuan dapat ditugaskan, dipantau sampai tenggat, dan ditutup dengan bukti serta jejak perubahan; pemantau tetap hanya membaca. Tambahkan tes transisi tidak sah, otorisasi, dan konsistensi aksi dari kedua antarmuka.

## 7. Tahap 4 — Jadwal dan pengingat

### Kondisi saat ini

`Schedule::pastikanAda()` dipanggil saat finalisasi inspeksi. `app/Http/Controllers/Petugas/BerandaController.php` menghitung tenggat secara terpisah karena aset yang belum diperiksa belum memiliki baris jadwal. `routes/console.php` belum mendefinisikan pekerjaan penjadwalan aplikasi.

### Keputusan domain sebelum implementasi

- Tentukan apakah periode mengikuti bulan kalender atau interval sejumlah hari. Jangan menyamakan keduanya secara diam-diam.
- Tentukan perlakuan aset yang baru diaktifkan, dinonaktifkan, atau dipindahkan pada pertengahan periode.
- Tentukan batas akhir hari dan zona waktu yang berlaku; uji tanggal jatuh tempo agar inspeksi pada hari tersebut tidak dianggap telat sejak pukul 00.00.
- Tentukan bagaimana pemeriksaan ulang memenuhi kewajiban pada periode yang sama.

### Pekerjaan

- [ ] Buat jadwal kewajiban sejak awal periode secara idempoten.
- [ ] Pertahankan kewajiban historis yang terlewat agar tidak hilang ketika bulan berganti.
- [ ] Gunakan sumber perhitungan yang konsisten untuk beranda, dasbor, dan laporan.
- [ ] Tambahkan pengingat mendekati tenggat dan eskalasi keterlambatan dengan pencegahan pengiriman ganda.
- [ ] Tentukan kanal dan penerima notifikasi bersama pemilik proyek; jangan langsung menghubungkan WhatsApp atau layanan berbayar.
- [ ] Untuk data lama, bedakan kewajiban yang dapat direkonstruksi dari data yang tidak cukup. Jangan mengarang riwayat kepatuhan.

**Selesai bila:** kewajiban muncul sebelum inspeksi, bulan terlewat tetap terlihat, menjalankan scheduler ulang tidak menggandakan jadwal/notifikasi, dan batas periode teruji untuk Februari serta bulan 30/31 hari.

## 8. Tahap 5 — Perlindungan bukti dan operasional

### Foto pemeriksaan

`app/Services/PhotoStore.php` menggunakan disk `public`; `app/Models/InspectionPhoto.php` menghasilkan URL publik. Ini adalah temuan konfigurasi dari kode, bukan bukti bahwa URL foto produksi sudah diakses pihak lain.

- [ ] Tetapkan siapa yang boleh membaca bukti foto, termasuk akses lintas divisi.
- [ ] Jika foto bersifat internal, layani melalui penyimpanan privat dan endpoint terotorisasi atau URL sementara sesuai kebutuhan.
- [ ] Rencanakan migrasi foto lama, pembaruan tampilan/PDF, dan pencabutan jalur publik lama setelah verifikasi. Jangan hanya memindahkan berkas lalu membiarkan URL lama tetap berfungsi.
- [ ] Uji pengguna tanpa login, peran tanpa izin, pemilik, pengelola, serta tautan yang sudah kedaluwarsa bila memakai URL sementara.

### Operasional

- [ ] Inventarisasi backup dan deployment yang sudah berjalan di server; ketiadaan konfigurasi dalam repositori bukan bukti bahwa backup belum ada.
- [ ] Backup database dan foto secara konsisten, tentukan retensi, lalu lakukan uji restore di lingkungan terpisah.
- [ ] Pantau kegagalan finalisasi, unggah foto, scheduler, kapasitas disk, serta pekerjaan antrean jika digunakan.
- [ ] Pastikan log tidak merekam token QR, kredensial, atau data sensitif yang tidak diperlukan.
- [ ] Tambahkan pemeriksaan tes dan build pada PR jika belum tersedia setelah merge.
- [ ] Sediakan prosedur rollback untuk perubahan skema dan penyimpanan sebelum deployment.

**Selesai bila:** data beserta foto dapat dipulihkan, pemeriksaan otomatis berjalan pada PR, dan kegagalan operasional dapat ditelusuri tanpa membocorkan data sensitif.

## 9. Pembagian PR yang disarankan

| PR | Lingkup | Ketergantungan |
| --- | --- | --- |
| 1 | Penguncian inspeksi final dan tes endpoint | Baseline hasil merge |
| 2 | Validasi checklist sesuai tipe dan opsi | PR 1 |
| 3 | Finalisasi idempoten dan perlindungan konkurensi | PR 1–2 |
| 4 | Antrean penyimpanan, retry, dan penantian sebelum kirim | PR 3 |
| 5 | Perapian formulir temuan dan konsistensi validasi | Milestone pertama stabil |
| 6 | PIC, bukti penyelesaian, dan riwayat perubahan | Keputusan alur kerja, PR 5 |
| 7 | Jadwal proaktif dan konsistensi perhitungan | Keputusan periode |
| 8 | Pengingat dan eskalasi | PR 7, keputusan kanal |
| 9 | Akses foto privat dan migrasi bukti lama | Keputusan akses bukti |
| 10 | Backup/restore dan pemeriksaan PR | Audit operasional |

Urutan ini boleh disesuaikan berdasarkan temuan baseline. Jangan menggabungkan semua pekerjaan ke satu PR besar. Pekerjaan foto privat dapat didahulukan jika menjadi kebutuhan akses data saat ini.

## 10. Verifikasi dan laporan handoff

Per perubahan perilaku, tambahkan tes regresi yang gagal sebelum perbaikan dan lulus sesudahnya. Utamakan hasil yang dapat diamati melalui endpoint, bukan tes yang hanya meniru isi implementasi.

Jalankan pengujian relevan terlebih dahulu. Contoh untuk area yang sudah tersedia:

```bash
php artisan test --compact tests/Feature/AlurLapanganTest.php
php artisan test --compact tests/Feature/OtorisasiPanelTest.php
```

Jalankan juga tes baru yang dibuat untuk perubahan tersebut. Jika PHP diubah, jalankan formatter sesuai aturan proyek:

```bash
vendor/bin/pint --dirty --format agent
```

Untuk perubahan frontend:

```bash
npm run build
```

Pada pemeriksaan integrasi akhir milestone, jalankan suite penuh di lingkungan pengujian terisolasi. Jangan menjalankan migrasi pengujian atau seeder pada database produksi.

Setiap handoff/PR harus menjelaskan:

1. Masalah dan perubahan perilaku bagi pengguna.
2. Temuan yang telah dibuktikan, bukan hanya dugaan dari pembacaan kode.
3. Pengujian yang dijalankan dan hasilnya.
4. Migrasi data, kompatibilitas, serta cara rollback bila ada.
5. Batasan yang tersisa dan keputusan yang masih diperlukan.

## 11. Instruksi awal siap salin ke agent

> Baca `plan.md` dan aturan proyek. Pastikan merge `pipeline/ui-admin` ke `main` sudah selesai, lalu mulai dari `main` terbaru pada checkout terpisah. Verifikasi kembali temuan karena rencana ini dibuat dari commit `5e9c397`. Kerjakan tahap 0, kemudian milestone “Inspeksi lapangan andal” (tahap 1–2) dalam PR kecil. Mulai dengan tes regresi penguncian inspeksi final, lanjut validasi checklist, finalisasi idempoten, dan antrean penyimpanan. Pertahankan desain yang sudah ada, gunakan dependensi terpasang, dan jangan mengubah data produksi. Tahap 3–5 adalah backlog lanjutan, bukan bagian otomatis dari milestone pertama.
