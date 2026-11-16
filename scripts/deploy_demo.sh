#!/usr/bin/env bash
# Deploy rilis demo ke tc-vps (sejak 9 Nov 2026; aws-vps tidak dipakai lagi).
#
# Server tidak memakai checkout git. Rilis dikirim sebagai satu arsip berisi
# kode dari `git archive` ditambah public/build yang dibangun dari commit sama:
#
#   git archive --format=tar -o rilis.tar <commit>
#   npm ci && npm run build
#   tar --force-local -rf rilis.tar public/build && gzip rilis.tar
#   scp rilis.tar.gz tc-vps:/tmp/
#   ssh tc-vps 'sudo bash -s <commit-40-hex> /tmp/rilis.tar.gz' < scripts/deploy_demo.sh
#
# Aplikasi: /home/ubuntu/pal-k3 (bind mount dari /root/data/disk/pal-k3), milik
# ubuntu, dilayani pal-k3.service (php artisan serve, 127.0.0.1:8011) dan
# diekspos cloudflared-pal-k3.service untuk geofencinspection.tech dan
# rifaldy.tiyoouw.app. vendor/ tidak disentuh: composer tidak terpasang di
# server, jadi rilis yang mengubah dependensi produksi butuh langkah terpisah.
#
# Pemulihan: hentikan pal-k3.service, ekstrak kode-lengkap.tar.gz dari folder
# backup ke folder aplikasi, salin database.sqlite dan .env kembali, lalu
# jalankan ulang layanan.
set -Eeuo pipefail

RELEASE="${1:?Commit rilis wajib diisi}"
ARCHIVE="${2:?Arsip rilis wajib diisi}"
[[ "$RELEASE" =~ ^[0-9a-f]{40}$ ]] || { echo 'Commit rilis tidak sah.' >&2; exit 1; }
[[ -f "$ARCHIVE" ]] || { echo 'Arsip rilis tidak ditemukan.' >&2; exit 1; }
[[ "$(id -u)" -eq 0 ]] || { echo 'Jalankan sebagai root (sudo).' >&2; exit 1; }

APP_DIR="${PAL_APP_DIR:-/home/ubuntu/pal-k3}"
APP_USER="${PAL_APP_USER:-ubuntu}"
APP_PORT="${PAL_APP_PORT:-8011}"
APP_URL="${PAL_APP_URL:-https://geofencinspection.tech}"
AS_APP=(sudo -n -u "$APP_USER")

STAGING="$(mktemp -d /tmp/pal-k3-staging-XXXXXX)"
tar -xzf "$ARCHIVE" -C "$STAGING"
[[ -f "$STAGING/artisan" && -f "$STAGING/public/build/manifest.json" ]] \
    || { echo 'Arsip tidak berisi kode lengkap dan public/build.' >&2; exit 1; }
chown -R "$APP_USER:$APP_USER" "$STAGING"

BACKUP_DIR="/home/$APP_USER/.pal-k3-backups/$(date -u +%Y%m%dT%H%M%SZ)-sebelum-${RELEASE:0:8}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$(dirname "$BACKUP_DIR")" "$BACKUP_DIR"
cd "$APP_DIR"
sqlite3 database/database.sqlite ".backup $BACKUP_DIR/database.sqlite"
[[ "$(sqlite3 "$BACKUP_DIR/database.sqlite" 'PRAGMA integrity_check;')" == ok ]]
cp -p .env "$BACKUP_DIR/.env"
chmod 600 "$BACKUP_DIR/.env"
tar -czf "$BACKUP_DIR/storage-app.tar.gz" -C "$APP_DIR" storage/app
tar -czf "$BACKUP_DIR/kode-lengkap.tar.gz" \
    --exclude=./storage/framework/sessions --exclude=./storage/framework/cache -C "$APP_DIR" .
chown -R "$APP_USER:$APP_USER" "$(dirname "$BACKUP_DIR")"
echo "Backup tersimpan: $BACKUP_DIR"

on_error() {
    echo "Deployment gagal. Backup: $BACKUP_DIR" >&2
    "${AS_APP[@]}" php artisan up --no-interaction || true
}
trap on_error ERR

"${AS_APP[@]}" php artisan down --retry=15 --no-interaction
rsync -a --delete \
    --exclude=/.env --exclude=/storage/ --exclude=/database/database.sqlite \
    --exclude=/vendor/ --exclude=/bootstrap/cache/ --exclude=/public/storage \
    --exclude=/public/vendor/ --exclude=/node_modules/ --exclude=/.phpunit.result.cache \
    "$STAGING/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

python3 - "$APP_URL" <<'PY'
import sys
from pathlib import Path
path = Path('.env')
values = {
    'DEMO_MODE': 'true',
    'APP_DEBUG': 'false',
    'APP_URL': sys.argv[1],
    'SESSION_SECURE_COOKIE': 'true',
}
lines = path.read_text().splitlines()
for key, value in values.items():
    if any(line.startswith(key + '=') for line in lines):
        lines = [key + '=' + value if line.startswith(key + '=') else line for line in lines]
    else:
        lines.append(key + '=' + value)
path.write_text('\n'.join(lines) + '\n')
PY

"${AS_APP[@]}" php artisan optimize:clear --no-interaction
"${AS_APP[@]}" php artisan package:discover --no-interaction
"${AS_APP[@]}" php artisan migrate --force --no-interaction
"${AS_APP[@]}" php artisan db:seed --class=DemoUserSeeder --force --no-interaction
if [[ ! -e public/storage && ! -L public/storage ]]; then
    "${AS_APP[@]}" php artisan storage:link --no-interaction
fi
"${AS_APP[@]}" php artisan optimize --no-interaction
"${AS_APP[@]}" php artisan up --no-interaction
systemctl restart pal-k3.service
curl --fail --silent --retry 5 --retry-connrefused --retry-delay 1 "http://127.0.0.1:$APP_PORT/" > /dev/null
systemctl is-active pal-k3.service
rm -rf "$STAGING"
echo "DEPLOYED $RELEASE"
echo "BACKUP $BACKUP_DIR"
