-- migrasi-data-disetujui: pemilik 19 Nov 2026 (ADR-17). Awalan token stiker PAL-K3- menjadi GIK3-;
-- isi heks tetap sehingga unik dan pemindai tetap menerima awalan lama sebagai alias.
-- Belum ada stiker yang tercetak. Idempoten: hanya baris berawalan lama yang diubah.
UPDATE "assets" SET "qr_token" = 'GIK3-' || substr("qr_token", 8) WHERE "qr_token" LIKE 'PAL-K3-%';
