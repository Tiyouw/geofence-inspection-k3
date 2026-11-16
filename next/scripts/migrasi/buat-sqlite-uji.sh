#!/usr/bin/env bash
# Membangun SQLite uji dari migrasi + seeder Laravel ASLI (cabang ini), tanpa PHP di
# mesin: semuanya di kontainer Docker sekali pakai. Tidak menyentuh tc-vps.
#
#   next/scripts/migrasi/buat-sqlite-uji.sh /folder/keluaran
#
# Hasil: KELUARAN/database.sqlite dan KELUARAN/foto/inspeksi/{id}/*.jpg (setara
# storage/app/public). Token QR di dalamnya acak dan hanya untuk uji: jangan di-commit.
set -euo pipefail
KELUAR="$(realpath "${1:?folder keluaran}")"
AKAR="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
mkdir -p "$KELUAR"
SUMBER="$(mktemp -d)"
trap 'rm -rf "$SUMBER"' EXIT
# Salinan bersih aplikasi Laravel dari HEAD (tanpa next/, tanpa .env lokal).
git -C "$AKAR" archive HEAD | tar -x -C "$SUMBER" --exclude=next
cp "$AKAR/next/scripts/migrasi/buat-sqlite-uji.php" "$SUMBER/buat-sqlite-uji.php"
DOCKER="docker"; docker info >/dev/null 2>&1 || DOCKER="sudo docker"
$DOCKER run --rm -v "$SUMBER:/app" -v "$KELUAR:/out" -w /app -e COMPOSER_ALLOW_SUPERUSER=1 composer:2 sh -euc '
  composer install --no-interaction --no-progress --no-scripts --ignore-platform-reqs -q
  cp .env.example .env
  sed -i "s/^DB_CONNECTION=.*/DB_CONNECTION=sqlite/; s/^#\? *DB_DATABASE=.*/DB_DATABASE=\/out\/database.sqlite/; s/^APP_TIMEZONE=.*/APP_TIMEZONE=Asia\/Jakarta/" .env
  grep -q "^DB_DATABASE=" .env || echo "DB_DATABASE=/out/database.sqlite" >> .env
  grep -q "^APP_TIMEZONE=" .env || echo "APP_TIMEZONE=Asia/Jakarta" >> .env
  sed -i "s/^DEMO_MODE=.*/DEMO_MODE=true/" .env
  echo "SEED_SANDI_AWAL=sandi-awal-uji" >> .env
  rm -f /out/database.sqlite && touch /out/database.sqlite
  php artisan key:generate --force -q
  php artisan migrate --seed --force -q
  php buat-sqlite-uji.php
  rm -rf /out/foto && mkdir -p /out/foto && cp -r storage/app/public/inspeksi /out/foto/
  chown -R '"$(id -u):$(id -g)"' /out /app
'
echo "SQLite uji: $KELUAR/database.sqlite"
