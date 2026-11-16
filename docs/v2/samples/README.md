# Contoh keluaran PDF

Dirender 16 Nov 2026 dari kode `main` (`00907a4`) tanpa mengubahnya: salinan aplikasi,
SQLite sementara, `MasterSeeder` + `AparSeeder` (35 APAR contoh), dua inspektur fiktif,
dan 30 inspeksi final Oktober 2026 yang dibangkitkan deterministik (5 aset sengaja belum
diperiksa, sebagian dengan temuan, 4 dengan status gerbang `perlu_review`). Temuan dibangun
oleh `IssueGenerator` asli, PDF oleh `LaporanController` asli (dompdf). Jam dibekukan
pada 2 Nov 2026 09:00 WIB.

| Berkas | Rute asal |
|---|---|
| `contoh-pms-apar-2026-10.pdf` | `/laporan/pms?tipe=apar&tahun=2026&bulan=10` |
| `contoh-rekap-temuan-2026-10.pdf` | `/laporan/temuan?tipe=apar&tahun=2026&bulan=10` |
| `contoh-kartu-kontrol.pdf` | `/laporan/kartu/{aset 31D}?tahun=2026` |

Bukan data asli. Tidak ada token QR di berkas ini.
