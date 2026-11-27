# Cutover v2 ke geofencinspection.tech (27 Nov 2026) dan cara rollback

## Yang berubah

| | Sebelum | Sesudah |
|---|---|---|
| Kode | `main` = Laravel saja | PR #81 (`rewrite/next` → `main`), merge `3718516`; Laravel tetap di root repo |
| Vercel `pal-k3` | production branch `rewrite/next` | production branch `main`; ignored build step membangun `main` dan `rewrite/next` |
| `geofencinspection.tech` | CNAME `711eb134-5ef3-4fe7-99cb-9480c14017cb.cfargotunnel.com`, proxied (tunnel `pal-k3` → Laravel di tc-vps) | A `216.198.79.1`, DNS only (Vercel) |
| `www.geofencinspection.tech` | CNAME `711eb134-5ef3-4fe7-99cb-9480c14017cb.cfargotunnel.com`, proxied | CNAME `cb3ebf7eb24323a6.vercel-dns-017.com`, DNS only; Vercel me-redirect 308 ke apex |
| `dev.geofencinspection.tech` | CNAME Vercel, mengikuti production (`rewrite/next`) | tidak berubah di DNS; sekarang mengikuti production (`main`) |

Catatan dev: domain cabang (`gitBranch: rewrite/next`) dicoba, tetapi deploy cabang dihitung
preview dan tertahan Vercel SSO Protection (`all_except_custom_domains`), jadi dev dikembalikan
mengikuti production. Push ke `rewrite/next` sekarang hanya membuat preview (butuh login Vercel).

Ingress tunnel `pal-k3` di tc-vps **tidak dihapus**; Laravel di tc-vps tetap jalan.

## Backup Laravel (sebelum cutover)

Homeserver `~/backups/pal-k3-laravel-2026-11-27/` (folder 700, berkas 600):
`database.sqlite` (salinan `.backup` read-only, integrity_check ok), `storage.tgz`, `.env`, `SHA256SUMS`.

## Rollback ke Laravel (± 5 menit)

Di Cloudflare, zone `geofencinspection.tech` (DNS):

1. Hapus A `geofencinspection.tech` → `216.198.79.1`.
2. Buat CNAME `geofencinspection.tech` → `711eb134-5ef3-4fe7-99cb-9480c14017cb.cfargotunnel.com`, **Proxied**.
3. Ubah CNAME `www` → `711eb134-5ef3-4fe7-99cb-9480c14017cb.cfargotunnel.com`, **Proxied**.
4. Cek: `curl -sI https://geofencinspection.tech/` menampilkan header Cloudflare dan halaman Laravel.

Tidak perlu mengubah tunnel atau tc-vps (ingress masih ada). Domain boleh tetap terdaftar di Vercel;
kalau ingin bersih, hapus `geofencinspection.tech` dan `www` dari project `pal-k3`.

Kalau data Laravel rusak: hentikan app, salin `database.sqlite` dan isi `storage.tgz` dari backup di
atas ke `/home/ubuntu/pal-k3/` (cocokkan dulu dengan `sha256sum -c SHA256SUMS`).

## Belum selesai

- `rifaldy.tiyoouw.app` masih menyajikan Laravel lewat tunnel. Redirect 301 ke
  `https://geofencinspection.tech/` butuh Redirect Rule di zone `tiyoouw.app`, dan token
  `cloudflare-tiyo` tidak berizin (`request is not authorized`). Rule yang diinginkan:
  `(http.host eq "rifaldy.tiyoouw.app")` → 301 `https://geofencinspection.tech/`.
