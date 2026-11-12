#!/usr/bin/env bash
# Perbarui aplikasi di server (Hostinger, via SSH) setelah `git push` dari laptop.
# Pakai:  bash scripts/update-server.sh
# JANGAN dijalankan saat voting berlangsung (mode maintenance menolak semua permintaan sesaat).
set -euo pipefail
cd "$(dirname "$0")/.."

php artisan down --retry=30 || true
trap 'php artisan up' EXIT

git pull --ff-only
composer install --no-dev --optimize-autoloader
chmod -R 775 storage bootstrap/cache

# Hapus SEMUA cache lama dulu (rute, config, view). Tanpa ini rute baru tidak dikenali
# ("The GET method is not supported for route ...").
php artisan optimize:clear

php artisan migrate --force   # DILARANG migrate:fresh / db:seed ulang di produksi

php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "Selesai. Cek rute baru: php artisan route:list --path=voters/export"
