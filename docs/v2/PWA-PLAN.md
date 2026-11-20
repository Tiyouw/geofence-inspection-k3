# Rencana PWA Inspektur

Audit PWA aplikasi INSPEKTUR (petugas lapangan) di `next/` pada cabang `rewrite/next`, untuk Perusahaan Galangan Kapal.
Dokumen ini hanya rencana. Belum ada kode yang diubah. Semua rujukan `file:baris` relatif terhadap `next/`.

## 1. Ringkasan

Dasar luring sudah kuat: draf dan antrean kiriman ada di IndexedDB per akun, setiap operasi punya Idempotency-Key, backoff eksponensial tanpa batas, Background Sync dipakai bila ada, dan iOS punya jalur cadangan (kuras saat aplikasi dibuka atau kembali ke depan).

Celah utama ada di sisi "aplikasi terpasang" dan kesiapan luring pertama:

- Halaman lapangan baru bisa dibuka luring bila JS/CSS-nya pernah dimuat daring. Pesan `hangatkan` hanya menyimpan HTML, tidak menyimpan aset halaman.
- Tidak ada ajakan pasang (Android) dan tidak ada panduan "Tambahkan ke Layar Utama" (iOS). Di iOS, situs yang tidak dipasang bisa kehilangan data skrip (termasuk antrean) setelah 7 hari tidak dibuka.
- Tidak ada pemantauan kuota (`navigator.storage.estimate()`), padahal SPEC §7 memintanya.
- Keluar bisa macet: service worker memegang koneksi IndexedDB yang tidak pernah ditutup, sehingga `deleteDB` tertahan.
- Batas foto di perangkat (6) bertentangan dengan batas di peladen (jumlah langkah × 5). Inspeksi APAR dengan lebih dari 6 foto ditolak di perangkat.
- Tidak ada alur pembaruan service worker yang terlihat oleh pengguna, dan cache statis tidak pernah dibersihkan.

## 2. Keadaan sekarang

| Area | Status | Bukti |
|---|---|---|
| Manifest: name, short_name, lang | Ada | `src/app/manifest.ts:5-8` |
| Manifest: start_url `/petugas`, scope `/` | Ada. Scope mencakup admin juga | `src/app/manifest.ts:9-10` |
| Manifest: display standalone, orientation portrait | Ada | `src/app/manifest.ts:11-12` |
| Manifest: theme/background `#031e25` | Ada, sama dengan `viewport.themeColor` | `src/app/manifest.ts:13-14`, `src/app/layout.tsx:21` |
| Ikon 192, 512, maskable 512, SVG | Ada, berkas ada (PNG RGB 192x192, 512x512) | `src/app/manifest.ts:15-20`, `public/icons/` |
| Manifest: `id`, `screenshots`, `shortcuts` | Tidak ada | `src/app/manifest.ts:4-21` |
| apple-touch-icon | Memakai ikon 192 (Apple menyarankan 180) | `src/app/layout.tsx:15` |
| appleWebApp capable, status bar `black-translucent` | Ada | `src/app/layout.tsx:17` |
| `viewport-fit=cover` | Tidak ada. `env(safe-area-inset-*)` bernilai 0 tanpa ini | `src/app/layout.tsx:20-24`, dipakai di `src/features/inspeksi/ui/kamera-terpandu.tsx:214,324` |
| Service worker: sumber dan build | `src/features/inspeksi/sw/index.ts` dibundel esbuild ke `public/sw.js` saat predev/prebuild; versi = hash 3 berkas | `scripts/build-sw.mjs:9-23`, `package.json` (predev, prebuild) |
| Registrasi SW | Hanya produksi, `updateViaCache: "none"` | `src/components/shell/sw-register.tsx:8-9` |
| Precache | Hanya `/offline` dan dua ikon | `src/features/inspeksi/sw/index.ts:23,26-28` |
| Halaman lapangan | Jaringan dulu, batas 4 detik, jatuh ke salinan; tidak menyimpan pengalihan ke `/masuk` | `src/features/inspeksi/sw/index.ts:24,49-70` |
| Navigasi lain | Jaringan, jatuh ke `/offline` | `src/features/inspeksi/sw/index.ts:91` |
| `/i/{token}` luring | Dialihkan ke `/petugas/pindai?token=…` | `src/features/inspeksi/sw/index.ts:84-89` |
| Aset statis | Cache-first, cache `pal-k3-static` tanpa versi dan tanpa batas | `src/features/inspeksi/sw/index.ts:21,95-105` |
| Halaman `/offline` | Ada, statis, publik | `src/app/(publik)/offline/page.tsx:5`, `src/lib/auth/access.ts:18` |
| Pembaruan SW | `skipWaiting` + `clients.claim` langsung; tidak ada prompt atau muat ulang | `src/features/inspeksi/sw/index.ts:27,35` |
| Pembersihan cache lama | Hanya precache lama yang dihapus | `src/features/inspeksi/sw/index.ts:30-36` |
| Hangatkan cangkang halaman | Hanya HTML, dikirim sekali bila `controller` sudah ada | `src/features/inspeksi/sw/index.ts:127-138`, `src/features/inspeksi/ui/konteks.tsx:116` |
| IndexedDB per akun | `pal-k3:{userId}`, store `meta`, `drafts`, `photos`, `outbox`, `sent`; versi 1 | `src/features/inspeksi/client/db.ts:17-49` |
| DB global pengguna aktif | `pal-k3` / `kv.userId` untuk SW | `src/features/inspeksi/client/db.ts:66-91` |
| Idempotency | `opId` UUIDv7 = header `Idempotency-Key` | `src/features/inspeksi/client/outbox.ts:66,103`, `src/features/inspeksi/client/ids.ts` |
| Retry/backoff | 2 dtk dikali dua, maks 5 menit, jitter, `Retry-After`, tanpa batas; 401 berhenti; 4xx lain "perlu tindakan" | `src/features/inspeksi/client/outbox.ts:15-43,232-251` |
| Urutan dan paralel | FIFO per inspeksi, maks 2 inspeksi paralel | `src/features/inspeksi/client/outbox.ts:203-258` |
| Kunci jendela/SW | Web Locks `pal-k3-outbox` | `src/features/inspeksi/client/sinkron.ts:14-18` |
| Pemicu kuras | `online`, `visibilitychange`, timer 30 dtk, setelah tulis, Background Sync | `src/features/inspeksi/client/sinkron.ts:61-89`, `src/features/inspeksi/ui/konteks.tsx:96-100` |
| Background Sync | Didaftarkan `outbox`, gagal diam di iOS | `src/features/inspeksi/client/sinkron.ts:50-58`, `src/features/inspeksi/sw/index.ts:120-123` |
| Periodic Background Sync | Tidak dipakai | (tidak ada rujukan di `src/`) |
| Lencana ikon aplikasi | `setAppBadge` jumlah antrean | `src/features/inspeksi/ui/konteks.tsx:138-144` |
| Foto | Sisi panjang ≤ 1600 px, JPEG 0,82, SHA-256 | `src/features/inspeksi/client/kompres.ts:7-37` |
| Batas foto | 5 per langkah di perangkat; 6 per inspeksi di perangkat; peladen `max(6, langkah × 5)`; 12 MB per foto | `src/lib/domain/langkah-foto.ts:32-37`, `src/lib/domain/constants.ts:191-192`, `src/features/inspeksi/client/aksi.ts:299-303`, `src/features/inspeksi/server/inspeksi.ts:178,401` |
| Pembersihan foto | Blob tetap sampai finalize diterima, lalu foto, draf, op dihapus | `src/features/inspeksi/client/outbox.ts:153-182` |
| `storage.persist()` | Dipanggil saat provider dimuat dan saat "Simpan semua"; hasil tidak diperiksa | `src/features/inspeksi/ui/konteks.tsx:119`, `src/features/inspeksi/ui/kamera-terpandu.tsx:101` |
| `storage.estimate()` | Tidak dipakai, padahal diminta SPEC | `docs/v2/SPEC.md:1172` |
| Keluar | Peringatan bila antrean ada, lalu `deleteDB`, hapus pengguna aktif, pesan `bersihkan` ke SW | `src/features/inspeksi/ui/status-bar.tsx:27-53`, `src/features/inspeksi/ui/konteks.tsx:159-164`, `src/features/inspeksi/sw/index.ts:140-143` |
| Koneksi DB di SW | Disimpan di `Map` dan tidak pernah ditutup; `openDB` tanpa `blocking` | `src/features/inspeksi/client/db.ts:27,36-46`, `src/features/inspeksi/sw/index.ts:112` |
| Ajakan pasang / deteksi standalone | Tidak ada (`beforeinstallprompt`, `display-mode` tidak dipakai) | (tidak ada rujukan di `src/`) |
| Kamera | `exact` → `ideal` → apa saja, lalu cocokkan label; `playsinline`; fokus kontinu | `src/features/inspeksi/client/qr.ts:28-64`, `src/features/inspeksi/ui/pemindai.tsx:75-86`, `src/features/inspeksi/ui/kamera-terpandu.tsx:267-290` |
| Galat kamera | Satu status "gagal" tanpa membedakan izin ditolak vs tidak ada kamera | `src/features/inspeksi/ui/kamera-terpandu.tsx:281-282`, `src/features/inspeksi/ui/pemindai.tsx:86,132` |
| Lokasi | `watchPosition` akurasi tinggi selama formulir dan kamera terbuka; status `ditolak` ditangani | `src/features/inspeksi/ui/kartu-lokasi.tsx:58-104`, `src/features/inspeksi/ui/kamera-terpandu.tsx:292-302` |
| Panduan izin lokasi | Hanya langkah Android | `src/lib/geo/gerbang.ts:132-136` |
| Header | `Permissions-Policy camera=(self), geolocation=(self), microphone=()`; `sw.js` no-store + `Service-Worker-Allowed: /` | `next.config.ts:47,59-66` |
| Proxy | Matcher mengecualikan `sw.js`, `manifest.webmanifest`, `icons/`, gambar | `src/proxy.ts:13` |
| Sesi | JWT 120 menit; 401 menahan antrean | `src/lib/auth/config.ts:12`, `src/features/inspeksi/client/outbox.ts:37` |
| Uji e2e luring | Ada satu alur: tunggu SW, `setOffline`, kirim, daring lagi | `e2e/petugas/alur.spec.ts:97-134` |

## 3. Celah per platform

### Android Chrome

1. Tidak ada tombol "Pasang aplikasi". Chrome hanya menampilkan info-bar sekali, lalu pengguna harus lewat menu. Event `beforeinstallprompt` tidak ditangkap. ([MDN beforeinstallprompt](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event))
2. Kesiapan luring pertama rapuh. `hangatkan` (`sw/index.ts:127-138`) hanya menyimpan HTML. JS/CSS halaman `/petugas/isi` dan `/petugas/pindai` hanya masuk cache bila halaman itu pernah dibuka daring (`sw/index.ts:95-105`). Selain itu `hangatkan` dikirim hanya bila `controller` sudah ada (`konteks.tsx:116`), jadi pada kunjungan pertama setelah pasang belum ada yang dihangatkan.
3. Cache `pal-k3-static` tidak punya versi dan tidak pernah dibersihkan (`sw/index.ts:21`). Setiap deploy menambah chunk baru.
4. Background Sync jalan, tetapi bila gagal karena 401 (sesi 120 menit habis) antrean menunggu sampai pengguna masuk lagi. Tidak ada notifikasi; hanya lencana dan label.
5. SW baru langsung mengambil alih (`skipWaiting`, `clients.claim`). Tidak ada tanda "versi baru tersedia". Halaman lama tetap memakai JS lama sampai dimuat ulang.
6. Manifest tanpa `id` (`manifest.ts:4-21`). Bila `start_url` berubah, Chrome bisa menganggapnya aplikasi lain. Tanpa `screenshots`, dialog pasang tidak menampilkan pratinjau (richer install UI).
7. `storage.persist()` biasanya dikabulkan otomatis untuk aplikasi terpasang, tetapi hasilnya tidak diperiksa atau ditampilkan.

### iOS Safari (dan mode standalone dari Layar Utama)

1. Tidak ada Background Sync dan Periodic Sync di Safari ([caniuse background-sync](https://caniuse.com/background-sync)). Kode sudah punya jalur cadangan (`sinkron.ts:77-81`), tetapi pengguna tidak diberi tahu bahwa aplikasi harus dibuka agar antrean terkirim.
2. Tidak ada panduan "Bagikan → Tambahkan ke Layar Utama". Ini penting: WebKit menghapus data skrip (IndexedDB, cache, SW) situs yang tidak dibuka 7 hari bila situs tidak dipasang ke Layar Utama ([WebKit: Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/), [WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)). Antrean yang belum terkirim bisa hilang.
3. Kuota iOS terbatas dan bergantung ruang disk; `persist()` didukung sejak Safari 17 ([WebKit: Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)). Aplikasi tidak memeriksa `estimate()` dan tidak memberi peringatan.
4. `getUserMedia` di mode standalone baru ada sejak iOS 13.4. Izin kamera dan lokasi di mode standalone sering ditanyakan ulang setiap sesi atau setelah aplikasi ditutup. Aplikasi sudah memakai `playsinline` (`pemindai.tsx:80`), tetapi pesan galat tidak membedakan "izin ditolak" (`NotAllowedError`) dari galat lain, dan tidak ada langkah iOS untuk mengaktifkan izin (Pengaturan → Privasi → Layanan Lokasi → Situs Web Safari). Panduan lokasi hanya untuk Android (`gerbang.ts:132-136`).
5. Status bar `black-translucent` (`layout.tsx:17`) tanpa `viewportFit: "cover"` (`layout.tsx:20-24`). Akibatnya `env(safe-area-inset-top)` bisa bernilai 0 dan konten bisa tertutup notch. Perlu dicek di perangkat.
6. `apple-touch-icon` memakai PNG 192 (`layout.tsx:15`); iOS mengecilkan sendiri. Tidak ada splash screen (`apple-touch-startup-image`), jadi layar putih saat dibuka.
7. `setAppBadge` hanya bekerja di iOS 16.4+ bila aplikasi terpasang dan izin notifikasi diberikan. Tanpa izin notifikasi lencana tidak muncul.
8. `BarcodeDetector` tidak ada di Safari; jsQR dipakai (`qr.ts:72-113`). Ini sudah benar.

### Keduanya

1. Batas foto di perangkat salah. `kirimInspeksi` memakai `MAKS_FOTO = 6` (`aksi.ts:302`, `constants.ts:191`), sedangkan kamera terpandu mengizinkan 5 per langkah (`langkah-foto.ts:32`) dan peladen memakai `max(6, langkah × 5)` (`server/inspeksi.ts:178,401`). APAR dengan 5 langkah bisa punya 25 foto, tetapi ditolak di perangkat bila lebih dari 6.
2. Keluar bisa macet. SW membuka DB lewat `bukaDb` dan menyimpannya di `Map` tanpa ditutup (`db.ts:27,33-49`, `sw/index.ts:112`). `deleteDB` dari jendela (`konteks.tsx:161`) tertahan (`blocked`) sampai SW berhenti. Tidak ada handler `blocking`/`versionchange`.
3. Sesi habis tidak membersihkan apa pun. Cangkang HTML berautentikasi di cache `pal-k3-halaman` hanya dihapus lewat tombol Keluar (`sw/index.ts:140-143`). Bila akun lain masuk di ponsel yang sama, salinan HTML akun lama masih bisa tampil saat luring.
4. Draf yang ditinggal tidak pernah kedaluwarsa, dan store `sent` hanya disaring 30 hari saat dibaca (`konteks.tsx:60`), tidak dihapus.
5. Scope manifest `/` mencakup halaman admin. Admin yang memasang aplikasi akan masuk ke `/petugas` lalu dialihkan.

## 4. Langkah kerja berurutan

Setiap langkah kecil, bisa diuji sendiri, dan satu PR.

- [ ] **1. (Must) Samakan batas foto di perangkat dengan peladen.** Ganti `MAKS_FOTO` di `aksi.ts:302` dengan `Math.max(MAKS_FOTO, maksFotoInspeksi(opsi.langkah))`.
  Cek: uji unit `kirimInspeksi` dengan 5 langkah × 2 foto lolos; e2e APAR dengan 7 foto terkirim.
- [ ] **2. (Must) Keluar tidak boleh macet.** Di `bukaDb` tambahkan `blocking() { db.close(); cache.delete(userId) }`; beri batas waktu dan pesan bila `deleteDB` tetap tertahan; SW menutup DB setelah `kurasLatar`.
  Cek: uji unit dengan dua koneksi terbuka, `deleteDB` selesai < 2 dtk; e2e keluar setelah Background Sync berjalan.
- [ ] **3. (Must) Hangatkan aset halaman lapangan.** Di `hangatkan`, setelah HTML disimpan, ambil URL `/_next/static/...` dari HTML (script dan stylesheet) lalu simpan ke cache statis. Kirim `hangatkan` juga setelah `navigator.serviceWorker.ready` (bukan hanya bila `controller` ada).
  Cek: e2e baru: masuk, buka `/petugas` saja, luring, buka `/petugas/isi?id=…` dan `/petugas/pindai` berhasil tampil dan interaktif.
- [ ] **4. (Must) Pantau kuota dan persist.** Hook kecil yang memanggil `navigator.storage.estimate()` dan `persisted()`; tampilkan peringatan bila sisa < 20% atau < 50 MB, dan status "penyimpanan belum permanen" bila `persist()` ditolak.
  Cek: uji unit dengan `estimate` tiruan; di DevTools → Application → Storage, "Simulate custom storage quota" memunculkan peringatan.
- [ ] **5. (Must) Panduan pasang iOS dan deteksi standalone.** Deteksi `matchMedia("(display-mode: standalone)")` atau `navigator.standalone`. Di iOS Safari yang belum terpasang, tampilkan kartu "Bagikan → Tambahkan ke Layar Utama" dengan alasan: data antrean bisa terhapus setelah 7 hari.
  Cek: e2e dengan user agent iPhone menampilkan kartu; dalam emulasi standalone kartu hilang.
- [ ] **6. (Should) Tombol pasang Android.** Tangkap `beforeinstallprompt`, simpan, tampilkan tombol "Pasang aplikasi" di beranda petugas; sembunyikan setelah `appinstalled`.
  Cek: Chrome Android/desktop menampilkan tombol, dialog pasang muncul, tombol hilang setelah dipasang.
- [ ] **7. (Should) Pesan izin kamera dan lokasi per platform.** Bedakan `NotAllowedError`, `NotFoundError`, `NotReadableError` di `pemindai.tsx` dan `kamera-terpandu.tsx`. Tambah `LANGKAH_LOKASI_IOS` dan `LANGKAH_KAMERA_IOS` di samping `gerbang.ts:132`, dipilih menurut platform.
  Cek: uji unit pemetaan galat → pesan; e2e dengan izin kamera ditolak menampilkan pesan izin.
- [ ] **8. (Should) Alur pembaruan SW.** Jangan `skipWaiting` otomatis di `install`; tunggu pesan `lewati` dari jendela. Tampilkan toast "Versi baru tersedia, muat ulang" saat `registration.waiting` ada dan tidak ada draf terbuka; muat ulang pada `controllerchange`.
  Cek: e2e: deploy dua build berbeda (ubah `__SW_VERSION__`), toast muncul, setelah tekan muat ulang versi baru aktif.
- [ ] **9. (Should) Bersihkan cache statis lama.** Beri versi pada `pal-k3-static` atau batasi jumlah entri (misalnya 200, buang yang tertua); hapus cache `pal-k3-halaman` saat pengguna aktif berganti.
  Cek: uji di DevTools → Application → Cache Storage setelah dua deploy: hanya satu set chunk; ganti akun mengosongkan `pal-k3-halaman`.
- [ ] **10. (Should) Safe area iOS.** Tambah `viewportFit: "cover"` di `layout.tsx` dan pastikan header/bilah bawah memakai `env(safe-area-inset-*)`.
  Cek: iPhone dengan notch, mode standalone: bilah atas tidak tertutup jam/notch.
- [ ] **11. (Should) Beri tahu pengguna iOS soal antrean.** Bila tidak ada Background Sync dan antrean > 0, tampilkan "Buka aplikasi saat ada sinyal agar antrean terkirim" di status bar.
  Cek: e2e dengan `SyncManager` dihapus menampilkan teks itu.
- [ ] **12. (Could) Lengkapi manifest.** Tambah `id: "/petugas"`, `screenshots` (satu `narrow` 1080x1920), `shortcuts` (Pindai QR → `/petugas/pindai`, Riwayat → `/petugas/riwayat`), dan ikon 180 khusus apple-touch-icon.
  Cek: DevTools → Application → Manifest tanpa peringatan; dialog pasang Android menampilkan pratinjau.
- [ ] **13. (Could) Kedaluwarsa data lokal.** Hapus entri `sent` lebih dari 30 hari; tandai draf tanpa perubahan lebih dari 14 hari dan tawarkan buang.
  Cek: uji unit dengan jam tiruan.
- [ ] **14. (Could) Splash screen iOS.** Tambah `apple-touch-startup-image` untuk ukuran iPhone umum.
  Cek: buka dari Layar Utama, tidak ada layar putih.
- [ ] **15. (Could) Scope khusus petugas.** Pertimbangkan `scope: "/petugas"` plus pengecualian `/i/` (atau tetap `/` dan biarkan admin tidak memasang). Butuh keputusan karena `/i/{token}` harus tetap tertangkap SW.
  Cek: keputusan tertulis; bila diubah, e2e stiker luring tetap lulus.

## 5. Cara uji

**Perangkat minimum**

- Android: satu ponsel kelas menengah (Android 12+), Chrome stabil, dipasang dari menu.
- iOS: satu iPhone iOS 17+ di Safari, dan aplikasi yang sama dipasang ke Layar Utama.
- Uji lapangan nyata: dalam bengkel beratap baja dan lambung kapal (sinyal dan GPS lemah).

**DevTools (Chrome desktop dengan emulasi ponsel, atau remote debugging `chrome://inspect`)**

- Application → Manifest: tidak ada peringatan installability; ikon dan maskable tampil benar.
- Application → Service Workers: versi aktif, centang "Update on reload" saat mengembangkan, uji "Offline".
- Application → Cache Storage: isi `pal-k3-precache-*`, `pal-k3-static`, `pal-k3-halaman`.
- Application → IndexedDB: `pal-k3` dan `pal-k3:{userId}`; periksa `outbox` saat luring.
- Application → Background Services → Background Sync: rekam event `outbox`.
- Application → Storage: "Simulate custom storage quota" untuk uji peringatan kuota.
- iOS: Safari di Mac → Develop → [iPhone] untuk memeriksa aplikasi Layar Utama.

**Lighthouse**: kategori PWA sudah dihapus sejak Lighthouse 12. Pakai panel Manifest (installability) dan audit Performance/Best Practices biasa ([Chrome: Lighthouse 12](https://developer.chrome.com/blog/lighthouse-12-0), [web.dev: kriteria install](https://web.dev/articles/install-criteria)).

**Skenario luring (manual dan e2e)**

1. Masuk daring, buka beranda petugas saja, tutup aplikasi.
2. Mode pesawat. Buka aplikasi dari ikon: beranda tampil, pindai QR (kamera), formulir terbuka, isi, jepret foto, kirim → status "Menunggu sinyal".
3. Matikan dan buka lagi aplikasi masih luring: draf dan antrean masih ada.
4. Daring lagi: Android terkirim tanpa membuka aplikasi (Background Sync); iOS terkirim saat aplikasi dibuka.
5. Ulangi dengan sesi kedaluwarsa (> 120 menit): status "Masuk lagi", masuk, antrean terkirim tanpa duplikat.
6. Keluar dengan antrean berisi: konfirmasi muncul, DB `pal-k3:{userId}` dan cache `pal-k3-halaman` hilang, proses tidak macet.

Perluas `e2e/petugas/alur.spec.ts:97-134` untuk langkah 3 dan 6. Ingat SW hanya didaftarkan di produksi (`sw-register.tsx:8`), jadi uji luring perlu `next build && next start`.

## 6. Risiko dan pertanyaan terbuka

**Risiko**

- iOS dapat menghapus data situs yang tidak dipasang setelah 7 hari tanpa dibuka. Antrean yang belum terkirim hilang tanpa jejak. Panduan pasang (langkah 5) adalah mitigasi utama.
- Kuota habis saat menyimpan foto akan melempar `QuotaExceededError` di `db.put("photos")` (`aksi.ts:222`). Pesannya saat ini teknis.
- Mengubah alur pembaruan SW (langkah 8) bisa membuat pengguna lama tertahan di versi lama bila toast diabaikan. Perlu batas, misalnya paksa saat tidak ada draf terbuka.
- Mengubah skema IndexedDB nanti butuh `upgrade` versi 2. SW lama dan jendela baru bisa berjalan bersamaan sebentar; `blocking` dari langkah 2 juga diperlukan untuk ini.
- Izin kamera/lokasi yang ditanya ulang di iOS standalone menambah langkah bagi inspektur. Perilaku pasti berbeda per versi iOS; harus diuji di perangkat yang dipakai di lapangan.

**Pertanyaan terbuka**

1. Ponsel inspektur milik perusahaan (MDM, bisa dipasang paksa) atau milik pribadi? Ini menentukan seberapa keras ajakan pasang.
2. Berapa banyak iPhone di antara inspektur? Bila sedikit, langkah iOS bisa turun menjadi Should.
3. Apakah satu ponsel dipakai bergantian oleh beberapa inspektur? Bila ya, langkah 9 (bersihkan cache saat ganti akun) naik menjadi Must.
4. Batas foto yang benar: 6 per inspeksi (konstanta lama) atau 5 per langkah (kamera terpandu)? Langkah 1 menganggap aturan peladen yang benar.
5. Apakah admin dan pemantau juga boleh memasang aplikasi, atau manifest hanya untuk petugas (langkah 15)?
6. Perlu notifikasi push untuk "antrean macet" atau "masuk lagi"? Belum direncanakan di sini.
