/**
 * Isi panduan /panduan (varian B: langkah + pratinjau), dipilih pemilik di kanvas b31e6c236866.
 * Tangkapan layar asli dev ada di public/panduan/*.webp (peta diburamkan). Koordinat sorotan dan
 * gerak dalam persen gambar. Dibuat dari generator kanvas; sunting langsung di sini.
 */
import type { Slide } from "./tipe";

export const SLIDES: Slide[] = [
  {
    "bab": "Pengenalan",
    "peran": "umum",
    "jenis": "sampul",
    "judul": "Coba PAL-K3 v2, langkah demi langkah",
    "teks": "Panduan ini memandu kamu mencoba sistem inspeksi K3 dari dua sisi: HP sebagai inspektur di lapangan, dan laptop sebagai admin dan pemantau. Sekitar 30 menit.",
    "langkah": [
      "Siapkan HP (Chrome atau Safari) dan laptop.",
      "Tiap bab memberi tahu akun demo yang dipakai.",
      "Ada yang aneh atau bingung? Tekan Masukan di pojok kanan bawah, kapan saja."
    ],
    "qr": [
      {
        "kunci": "masuk",
        "label": "Pindai untuk membuka halaman masuk di HP"
      }
    ],
    "coba": {
      "label": "Buka halaman masuk",
      "href": "/masuk"
    },
    "id": "pengenalan-coba-pal-k3-v2-langkah-demi-langkah"
  },
  {
    "bab": "Pengenalan",
    "peran": "umum",
    "jenis": "masalah",
    "judul": "Kartu kertas di tabung diganti pemeriksaan dari HP",
    "teks": "Di Perusahaan Galangan Kapal, peralatan darurat K3 diperiksa rutin. Selama ini hasilnya ditulis di kartu yang digantung di tabung, lalu direkap manual tiap akhir bulan.",
    "kolom": [
      {
        "judul": "Sebelumnya",
        "butir": [
          "Kartu kertas bisa diisi tanpa datang ke tabung",
          "Rekap bulanan disalin tangan",
          "Temuan rusak mudah terlewat"
        ]
      },
      {
        "judul": "Dengan PAL-K3",
        "butir": [
          "Formulir hanya terbuka setelah stiker QR dipindai",
          "Lokasi HP dan foto jadi bukti pemeriksaan",
          "Laporan PDF dan temuan tersusun otomatis"
        ]
      }
    ],
    "id": "pengenalan-kartu-kertas-di-tabung-diganti-pemeriksaan-dari-h"
  },
  {
    "bab": "Pengenalan",
    "peran": "umum",
    "jenis": "modul",
    "judul": "Empat modul peralatan",
    "teks": "Tiap modul punya checklist sendiri, berdasar Permenaker 04/MEN/1980 dan NFPA 10, dengan warna dan gambar yang sama di semua layar.",
    "modul": [
      {
        "kunci": "apar",
        "nama": "APAR",
        "teks": "Alat pemadam api ringan. 10 butir: isi, tekanan, fisik, saluran, penempatan."
      },
      {
        "kunci": "p3k",
        "nama": "Kotak P3K",
        "teks": "Isi kotak dicocokkan dengan jumlah baku per tipe A, B, atau C."
      },
      {
        "kunci": "hp",
        "nama": "Hydrant",
        "teks": "Pilar dan box: selang, nozzle, kopling, kebocoran."
      },
      {
        "kunci": "pmk",
        "nama": "Mobil Pemadam",
        "teks": "Diperiksa mingguan: mesin, pompa, tangki, perlengkapan."
      }
    ],
    "id": "pengenalan-empat-modul-peralatan"
  },
  {
    "bab": "Pengenalan",
    "peran": "umum",
    "jenis": "peran",
    "judul": "Tiga peran, tiga warna",
    "teks": "Tiap peran melihat halaman yang berbeda. Warna latar bab di panduan ini mengikuti warna peran di aplikasi.",
    "peranlist": [
      {
        "peran": "inspektur",
        "nama": "Inspektur",
        "alat": "HP",
        "teks": "Memindai stiker, mengisi checklist, memotret bukti. Bisa tanpa sinyal.",
        "akun": "inspektur / inspektur123"
      },
      {
        "peran": "admin",
        "nama": "Admin K3",
        "alat": "Laptop",
        "teks": "Mengelola aset, area, jadwal, stiker; meninjau kiriman yang janggal; mengunduh laporan.",
        "akun": "admin / admin123"
      },
      {
        "peran": "pemantau",
        "nama": "Pemantau",
        "alat": "Laptop",
        "teks": "Hanya melihat: papan pantau, tinjauan, dan laporan PDF untuk manajemen.",
        "akun": "pemantau / pemantau123"
      }
    ],
    "id": "pengenalan-tiga-peran-tiga-warna"
  },
  {
    "bab": "Inspektur",
    "peran": "inspektur",
    "judul": "Pasang aplikasi di HP",
    "alat": "hp",
    "shot": "m-masuk",
    "teks": "Aplikasi inspektur berupa PWA: dibuka dari peramban, lalu dipasang ke layar utama supaya terasa seperti aplikasi biasa dan tetap jalan tanpa sinyal.",
    "langkah": [
      "Pindai QR di samping dengan kamera HP.",
      "Android (Chrome): menu ⋮ lalu Instal aplikasi.",
      "iPhone (Safari): tombol Bagikan lalu Tambahkan ke Layar Utama.",
      "Buka Inspeksi K3 dari ikon barunya."
    ],
    "akun": "inspektur",
    "qr": [
      {
        "kunci": "masuk",
        "label": "Buka di HP"
      }
    ],
    "coba": {
      "label": "Buka di HP",
      "href": "/masuk"
    },
    "id": "inspektur-pasang-aplikasi-di-hp"
  },
  {
    "bab": "Inspektur",
    "peran": "inspektur",
    "judul": "Masuk sebagai inspektur",
    "alat": "hp",
    "shot": "m-masuk",
    "teks": "Masuk memakai NIP dan kata sandi. Untuk percobaan, pakai akun demo di bawah. Aplikasi langsung membuka beranda inspektur.",
    "langkah": [
      "Isi NIP: inspektur",
      "Isi kata sandi: inspektur123",
      "Tekan Masuk."
    ],
    "akun": "inspektur",
    "coba": {
      "label": "Buka halaman masuk",
      "href": "/masuk"
    },
    "id": "inspektur-masuk-sebagai-inspektur"
  },
  {
    "bab": "Inspektur",
    "peran": "inspektur",
    "judul": "Beranda: apa yang belum diperiksa",
    "alat": "hp",
    "shot": "i-beranda",
    "teks": "Beranda menunjukkan progres periode ini dan daftar aset yang belum diperiksa, diurutkan dari tenggat terdekat.",
    "langkah": [
      "Lihat kartu progres: berapa aset sudah diperiksa.",
      "Tombol kuning Pindai stiker adalah aksi utama.",
      "Gulir daftar Belum diperiksa."
    ],
    "hot": [
      {
        "x": 4,
        "y": 17.8,
        "w": 91.8,
        "h": 19,
        "label": "Progres periode"
      },
      {
        "x": 4.1,
        "y": 39.3,
        "w": 91.8,
        "h": 6.6,
        "label": "Aksi utama"
      }
    ],
    "akun": "inspektur",
    "coba": {
      "label": "Buka beranda",
      "href": "/petugas"
    },
    "id": "inspektur-beranda-apa-yang-belum-diperiksa",
    "gerak": [
      {
        "j": "ketuk",
        "di": [
          50,
          42.6
        ],
        "label": "Ketuk Pindai stiker"
      }
    ]
  },
  {
    "bab": "Inspektur",
    "peran": "inspektur",
    "jenis": "stiker",
    "judul": "Pindai stiker contoh dari layar ini",
    "alat": "hp",
    "shot": "i-pindai",
    "teks": "Di lapangan, stiker QR ditempel di dinding dekat peralatan. Untuk percobaan, arahkan pemindai di aplikasi ke salah satu stiker DEMO di bawah.",
    "langkah": [
      "Di HP: buka Pindai, tekan Nyalakan kamera.",
      "Arahkan ke salah satu QR di layar laptop.",
      "Formulir aset itu langsung terbuka."
    ],
    "hot": [
      {
        "x": 4.1,
        "y": 50.6,
        "w": 91.8,
        "h": 41.8,
        "label": "Kamera pemindai"
      }
    ],
    "akun": "inspektur",
    "stiker": [
      {
        "kode": "DEMO-A01",
        "jenis": "APAR",
        "modul": "apar"
      },
      {
        "kode": "DEMO-A03",
        "jenis": "APAR",
        "modul": "apar"
      },
      {
        "kode": "DEMO-P01",
        "jenis": "Kotak P3K",
        "modul": "p3k"
      },
      {
        "kode": "DEMO-HP1",
        "jenis": "Hydrant pilar",
        "modul": "hp"
      }
    ],
    "id": "inspektur-pindai-stiker-contoh-dari-layar-ini",
    "gerak": [
      {
        "j": "pindai",
        "kotak": [
          4.1,
          50.6,
          91.8,
          41.8
        ],
        "label": "Arahkan ke QR"
      }
    ]
  },
  {
    "bab": "Inspektur",
    "peran": "inspektur",
    "jenis": "trio",
    "judul": "Lokasi: tiga kemungkinan hasil",
    "alat": "hp",
    "teks": "Setelah stiker dipindai, HP mencocokkan posisinya dengan gedung aset. Hasilnya tampil di kartu Lokasi.",
    "trio": [
      {
        "shot": "f-ok-1",
        "judul": "Lokasi sesuai",
        "teks": "Posisi di dalam gedung aset. Bisa dikirim.",
        "nada": "ok"
      },
      {
        "shot": "f-lemah-1",
        "judul": "Perlu tinjauan",
        "teks": "GPS lemah atau sedikit di luar gedung. Tetap bisa dikirim, admin yang menilai.",
        "nada": "warn"
      },
      {
        "shot": "f-jauh-1",
        "judul": "Di luar galangan",
        "teks": "Jauh dari kawasan. Akun asli: Kirim dimatikan. Akun demo: tetap bisa dikirim (Mode demo).",
        "nada": "bad"
      }
    ],
    "catatan": "Kamu tidak sedang di galangan, jadi HP-mu akan menampilkan Di luar galangan. Untuk akun demo, kiriman tetap bisa diteruskan sampai Terkirim dan diberi lencana Mode demo, lalu masuk antrean Tinjauan admin. Akun petugas asli tetap ditolak.",
    "akun": "inspektur",
    "id": "inspektur-lokasi-tiga-kemungkinan-hasil"
  },
  {
    "bab": "Inspektur",
    "peran": "inspektur",
    "judul": "Kamera terpandu untuk foto bukti",
    "alat": "hp",
    "shot": "f-kamera-1",
    "teks": "Foto diambil langkah demi langkah. Tiap langkah menyebut apa yang harus terlihat dan butir checklist mana yang dibuktikan.",
    "langkah": [
      "Di formulir, tekan Mulai kamera terpandu.",
      "Ikuti judul tiap langkah, tekan tombol kuning.",
      "Lanjut sampai semua langkah selesai."
    ],
    "hot": [
      {
        "x": 0,
        "y": 2.4,
        "w": 100,
        "h": 18,
        "label": "Apa yang difoto"
      },
      {
        "x": 38.5,
        "y": 84.7,
        "w": 23,
        "h": 10.7,
        "label": "Ambil foto"
      }
    ],
    "catatan": "Gambar hijau di tangkapan ini adalah kamera tiruan saat diambil otomatis; di HP-mu muncul kamera asli.",
    "akun": "inspektur",
    "id": "inspektur-kamera-terpandu-untuk-foto-bukti",
    "gerak": [
      {
        "j": "ketuk",
        "di": [
          50,
          90
        ],
        "label": "Ambil foto"
      }
    ]
  },
  {
    "bab": "Inspektur",
    "peran": "inspektur",
    "jenis": "duo",
    "judul": "Tanpa sinyal tetap jalan",
    "alat": "hp",
    "teks": "Di lambung kapal atau bengkel baja, sinyal sering hilang. Inspeksi disimpan di HP dan dikirim otomatis begitu sinyal kembali.",
    "duo": [
      {
        "shot": "f-luring",
        "label": "Penanda Luring di kanan atas",
        "hot": {
          "x": 76.7,
          "y": 1.9,
          "w": 19.2,
          "h": 2.8,
          "label": "Penanda Luring di kanan atas"
        }
      },
      {
        "shot": "i-antrean",
        "label": "Antrean kirim",
        "hot": {
          "x": 4.1,
          "y": 19.9,
          "w": 91.8,
          "h": 10.9,
          "label": "Antrean kirim"
        }
      }
    ],
    "langkah": [
      "Matikan data dan Wi-Fi HP.",
      "Pindai stiker, isi beberapa butir.",
      "Nyalakan lagi: buka Antrean dan lihat statusnya."
    ],
    "akun": "inspektur",
    "id": "inspektur-tanpa-sinyal-tetap-jalan"
  },
  {
    "bab": "Admin K3",
    "peran": "admin",
    "judul": "Ringkasan: satu layar untuk hari ini",
    "alat": "laptop",
    "shot": "a-dasbor",
    "teks": "Masuk di laptop sebagai admin. Ringkasan menunjukkan progres tiap modul, kepatuhan bulan ini, dan hal yang menunggu keputusan.",
    "langkah": [
      "Masuk dengan akun admin.",
      "Lihat progres per modul di baris atas.",
      "Klik kartu Perlu tinjauan."
    ],
    "hot": [
      {
        "x": 20,
        "y": 20,
        "w": 77.8,
        "h": 22.7,
        "label": "Progres per modul"
      },
      {
        "x": 64,
        "y": 44.7,
        "w": 16.4,
        "h": 19.6,
        "label": "Menunggu keputusan"
      }
    ],
    "akun": "admin",
    "coba": {
      "label": "Buka ringkasan admin",
      "href": "/admin"
    },
    "id": "admin-k3-ringkasan-satu-layar-untuk-hari-ini",
    "gerak": [
      {
        "j": "ketuk",
        "di": [
          72.2,
          54.4
        ],
        "label": "Klik Perlu tinjauan"
      }
    ]
  },
  {
    "bab": "Admin K3",
    "peran": "admin",
    "judul": "Lokasi & area: batas gedung",
    "alat": "laptop",
    "shot": "a-lokasi",
    "teks": "Batas tiap gedung dipakai untuk mengecek apakah inspektur benar-benar berada di dekat aset. Area baru digambar, diperiksa, lalu disetujui.",
    "langkah": [
      "Buka Lokasi & area.",
      "Pilih satu area di daftar kanan.",
      "Perhatikan tiga langkah di atas peta."
    ],
    "hot": [
      {
        "x": 20,
        "y": 21.5,
        "w": 62.6,
        "h": 5,
        "label": "Gambar, periksa, setujui"
      }
    ],
    "catatan": "Peta di tangkapan ini sengaja diburamkan: denah galangan bersifat rahasia.",
    "akun": "admin",
    "coba": {
      "label": "Buka Lokasi & area",
      "href": "/admin/lokasi"
    },
    "id": "admin-k3-lokasi-area-batas-gedung",
    "gerak": [
      {
        "j": "ketuk",
        "di": [
          54.4,
          44.2
        ],
        "label": "Gambar area"
      },
      {
        "j": "gambar",
        "titik": [
          [
            33,
            58
          ],
          [
            52,
            54
          ],
          [
            56,
            74
          ],
          [
            40,
            82
          ],
          [
            33,
            58
          ]
        ],
        "label": "Klik sudut-sudut gedung"
      }
    ]
  },
  {
    "bab": "Admin K3",
    "peran": "admin",
    "judul": "Jadwal: kapan tiap gedung diperiksa",
    "alat": "laptop",
    "shot": "a-jadwal",
    "teks": "Kalender bulanan per modul. Kelompok aset yang belum dijadwalkan ada di panel kanan.",
    "langkah": [
      "Buka Jadwal.",
      "Seret satu kartu dari panel kanan ke tanggal.",
      "Ganti tampilan Bulan dan Minggu."
    ],
    "hot": [
      {
        "x": 74.2,
        "y": 26,
        "w": 23.6,
        "h": 73,
        "label": "Seret ke kalender"
      }
    ],
    "akun": "admin",
    "coba": {
      "label": "Buka Jadwal",
      "href": "/admin/jadwal"
    },
    "id": "admin-k3-jadwal-kapan-tiap-gedung-diperiksa",
    "gerak": [
      {
        "j": "seret",
        "dari": [
          76.7,
          39.1
        ],
        "ke": [
          54.2,
          84.4
        ],
        "label": "Seret ke tanggal"
      },
      {
        "j": "chip",
        "titik": [
          [
            64.8,
            28.2
          ],
          [
            70,
            28.2
          ]
        ],
        "label": "Bulan ↔ Minggu"
      }
    ]
  },
  {
    "bab": "Admin K3",
    "peran": "admin",
    "judul": "Tinjauan: kiriman yang janggal",
    "alat": "laptop",
    "shot": "a-tinjauan",
    "teks": "Kiriman dengan GPS lemah, di luar gedung, dari area terbatas, atau diisi terlalu cepat masuk ke sini. Admin menerima atau menolak.",
    "langkah": [
      "Buka Tinjauan.",
      "Baca label alasan di kanan tiap baris.",
      "Klik Tinjau, lalu Terima atau Tolak."
    ],
    "hot": [
      {
        "x": 20,
        "y": 19.6,
        "w": 77.8,
        "h": 5.4,
        "label": "Saring per status"
      },
      {
        "x": 20,
        "y": 38.3,
        "w": 77.8,
        "h": 8.9,
        "label": "Alasan masuk tinjauan"
      }
    ],
    "akun": "admin",
    "coba": {
      "label": "Buka Tinjauan",
      "href": "/admin/tinjauan"
    },
    "id": "admin-k3-tinjauan-kiriman-yang-janggal",
    "gerak": [
      {
        "j": "chip",
        "titik": [
          [
            25.8,
            22.3
          ],
          [
            49.8,
            22.3
          ],
          [
            60.4,
            22.3
          ],
          [
            25.8,
            22.3
          ]
        ],
        "label": "Ganti saringan"
      },
      {
        "j": "ketuk",
        "di": [
          94.6,
          42.8
        ],
        "label": "Klik Tinjau"
      }
    ]
  },
  {
    "bab": "Admin K3",
    "peran": "admin",
    "judul": "Stiker QR: cetak di kertas label",
    "alat": "laptop",
    "shot": "html-a-stiker",
    "teks": "Pilih aset dan ukuran label, periksa pratinjau, lalu cetak lewat dialog cetak peramban.",
    "langkah": [
      "Buka Stiker QR.",
      "Ketik kode DEMO-A01 di Kode aset tertentu.",
      "Lihat pratinjau, lalu tekan Cetak (boleh dibatalkan)."
    ],
    "hot": [
      {
        "x": 20,
        "y": 19.7,
        "w": 52.2,
        "h": 46.4,
        "label": "Pilih aset"
      },
      {
        "x": 91.6,
        "y": 13.4,
        "w": 6.2,
        "h": 3.4,
        "label": "Cetak"
      }
    ],
    "akun": "admin",
    "coba": {
      "label": "Buka Stiker QR",
      "href": "/stiker"
    },
    "id": "admin-k3-stiker-qr-cetak-di-kertas-label",
    "gerak": [
      {
        "j": "ketuk",
        "di": [
          94.7,
          15.1
        ],
        "label": "Cetak"
      }
    ]
  },
  {
    "bab": "Admin K3",
    "peran": "admin",
    "judul": "Laporan bulanan",
    "alat": "laptop",
    "shot": "a-laporan",
    "teks": "Lembar PMS per modul, rekap temuan dengan foto, dan kartu kontrol per unit, siap diunduh sebagai PDF.",
    "langkah": [
      "Buka Laporan.",
      "Pilih modul dan bulan, tekan Tampilkan.",
      "Unduh Lembar PMS (PDF)."
    ],
    "akun": "admin",
    "coba": {
      "label": "Buka Laporan",
      "href": "/laporan"
    },
    "id": "admin-k3-laporan-bulanan"
  },
  {
    "bab": "Pemantau",
    "peran": "pemantau",
    "judul": "Papan pantau untuk manajemen",
    "alat": "laptop",
    "shot": "p-papan",
    "teks": "Keluar dari akun admin, lalu masuk sebagai pemantau. Pemantau hanya bisa melihat: ringkasan siap dibacakan, temuan berat, dan laporan.",
    "langkah": [
      "Keluar (ikon di kiri bawah), masuk dengan akun pemantau.",
      "Baca paragraf Ringkasan untuk manajemen.",
      "Lihat Laporan siap cetak di kanan."
    ],
    "hot": [
      {
        "x": 21,
        "y": 25.5,
        "w": 49.3,
        "h": 8,
        "label": "Ringkasan dalam kalimat"
      },
      {
        "x": 72.5,
        "y": 47.8,
        "w": 25.3,
        "h": 22.4,
        "label": "Laporan siap cetak"
      }
    ],
    "akun": "pemantau",
    "coba": {
      "label": "Buka papan pantau",
      "href": "/pemantau"
    },
    "id": "pemantau-papan-pantau-untuk-manajemen"
  },
  {
    "bab": "Pemantau",
    "peran": "pemantau",
    "judul": "Melihat tinjauan tanpa mengubah",
    "alat": "laptop",
    "shot": "p-tinjauan",
    "teks": "Pemantau melihat antrean tinjauan yang sama dengan admin, tetapi tanpa tombol Terima atau Tolak.",
    "langkah": [
      "Buka Tinjauan.",
      "Buka satu kiriman: foto, lokasi, dan jawaban.",
      "Pastikan tidak ada tombol untuk mengubah."
    ],
    "akun": "pemantau",
    "coba": {
      "label": "Buka tinjauan",
      "href": "/pemantau/tinjauan"
    },
    "id": "pemantau-melihat-tinjauan-tanpa-mengubah"
  },
  {
    "bab": "Pemantau",
    "peran": "pemantau",
    "judul": "Unduh laporan PDF",
    "alat": "laptop",
    "shot": "p-laporan",
    "teks": "Laporan yang sama dengan admin: Lembar PMS, rekap temuan dengan atau tanpa foto, dan progres per gedung.",
    "langkah": [
      "Buka Laporan.",
      "Tekan Lembar PMS (PDF).",
      "Buka PDF-nya dan bandingkan dengan format kertas lama."
    ],
    "hot": [
      {
        "x": 20,
        "y": 32.6,
        "w": 42.2,
        "h": 4.3,
        "label": "Unduh PDF"
      }
    ],
    "akun": "pemantau",
    "coba": {
      "label": "Buka laporan",
      "href": "/pemantau/laporan"
    },
    "id": "pemantau-unduh-laporan-pdf",
    "gerak": [
      {
        "j": "ketuk",
        "di": [
          27,
          34.7
        ],
        "label": "Unduh PDF"
      }
    ]
  },
  {
    "bab": "Selesai",
    "peran": "umum",
    "jenis": "selesai",
    "judul": "Sudah dicoba semua. Terima kasih, Faldy",
    "teks": "Setiap masukan yang kamu kirim langsung masuk ke halaman admin pengembang, lengkap dengan slide asalnya. Tidak perlu dirapikan: tulis saja seperti chat.",
    "langkah": [
      "Bug: ada yang error atau tidak bisa diklik.",
      "Aneh: jalan, tapi terasa janggal.",
      "Pertanyaan: belum paham maksudnya.",
      "Saran: sebaiknya begini."
    ],
    "id": "selesai-sudah-dicoba-semua-terima-kasih-faldy"
  }
];
