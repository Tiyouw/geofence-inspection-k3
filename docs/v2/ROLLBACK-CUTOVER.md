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

## rifaldy.tiyoouw.app (27 Nov 2026)

Domain lama dialihkan lewat fitur redirect domain bawaan Vercel, bukan Redirect Rule Cloudflare
(token `cloudflare-tiyo` tidak berizin Redirect Rules, tapi berizin edit DNS).

| | Sebelum | Sesudah |
|---|---|---|
| DNS `rifaldy` (zone `tiyoouw.app`, record `c99523db9572dd9ee6caa6c0c3174ec5`) | CNAME `711eb134-5ef3-4fe7-99cb-9480c14017cb.cfargotunnel.com`, **Proxied** | CNAME `cname.vercel-dns.com`, DNS only |
| Vercel project `pal-k3` | tidak ada | domain `rifaldy.tiyoouw.app`, redirect **308** ke `geofencinspection.tech` (path ikut) |

Sertifikat Let's Encrypt untuk `rifaldy.tiyoouw.app` terbit (berlaku s.d. 25 Feb 2027). Record lain di
zone `tiyoouw.app` dibandingkan sebelum/sesudah: tidak ada yang berubah. Ingress tunnel di tc-vps tidak
disentuh.

Rollback (kembali ke Laravel lewat tunnel):

1. Cloudflare → zone `tiyoouw.app` → DNS: ubah CNAME `rifaldy` kembali ke
   `711eb134-5ef3-4fe7-99cb-9480c14017cb.cfargotunnel.com`, **Proxied**.
2. Vercel → project `pal-k3` → Domains: hapus `rifaldy.tiyoouw.app` (opsional, setelah langkah 1 domain
   itu tidak menerima trafik lagi).
3. Cek: `curl -sI https://rifaldy.tiyoouw.app/` tidak lagi `server: Vercel` / 308, dan menampilkan Laravel.
