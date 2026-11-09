# Deploy ke Hostinger (shared hosting, PHP + MySQL)

Alur: **laptop** build → commit `public/build` + `public/wasm` → `git push` → **server** `git pull` + composer + migrate.
Tidak ada Node.js/Python di server.

## 1. Sekali saja — persiapan server

1. **Domain & HTTPS**: aktifkan SSL (wajib — kamera hanya jalan di HTTPS). Disarankan Cloudflare di depan domain (mode SSL *Full (strict)*).
2. **PHP 8.2/8.3** (hPanel → Advanced → PHP Configuration): aktifkan `pdo_mysql`, `mbstring`, `fileinfo`, `gd`, `zip`, **OPcache**. `memory_limit` ≥ 256M.
3. **Database MySQL**: buat DB + user di hPanel. Catat nama/user/sandi.
4. **SSH** (hPanel → Advanced → SSH Access), lalu:
   ```bash
   cd ~/domains/pemilihan.contoh.id
   git clone <url-repo> app
   cd app
   composer install --no-dev --optimize-autoloader
   cp .env.example .env    # lalu edit — lihat bagian 2
   php artisan key:generate
   php artisan migrate --force
   php artisan db:seed --force      # akun awal; catat sandi yang dicetak bila SEED_* kosong
   php artisan storage:link         # foto kandidat
   php artisan config:cache && php artisan route:cache && php artisan view:cache
   ```
5. **Document root → folder `public/`**. Di Hostinger: arahkan `public_html` ke `app/public` (symlink), contoh:
   ```bash
   cd ~/domains/pemilihan.contoh.id && mv public_html public_html.bak && ln -s app/public public_html
   ```
6. **Model wajah**: unggah manual 3 berkas ke `app/public/models/` (lihat `public/models/README.md`), lalu cek checksum:
   ```bash
   sha256sum app/public/models/*
   ```
7. **Cron** (hPanel → Advanced → Cron Jobs), tiap menit:
   ```
   * * * * * cd ~/domains/pemilihan.contoh.id/app && php artisan schedule:run >> /dev/null 2>&1
   ```
   (tutup otomatis saat jam tutup, segel ledger, bersihkan tiket kedaluwarsa)

## 2. `.env` produksi (wajib diperiksa)

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://pemilihan.contoh.id
APP_TIMEZONE=UTC            # waktu disimpan UTC; tampilan WIB diatur frontend
DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=...
DB_USERNAME=...
DB_PASSWORD=...
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=pemilihan.contoh.id
CACHE_STORE=file
LOG_LEVEL=warning
FACE_MODEL_VERSION=buffalo_s/w600k_mbf
SECURITY_CSP=true
SEED_ADMIN_EMAIL=admin@sekolah.sch.id
SEED_ADMIN_PASSWORD=        # kosong → dibuat acak & dicetak saat db:seed
```

## 3. Setiap rilis

Di laptop:
```powershell
npm ci
npm run build            # menyalin public/wasm + membangun public/build
php artisan test
git add -A
git commit -m "feat: ..."
git push
```
Di server (SSH):
```bash
cd ~/domains/pemilihan.contoh.id/app
php artisan down --retry=30          # JANGAN saat voting berlangsung
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force          # DILARANG migrate:fresh / db:seed ulang di produksi
php artisan config:cache && php artisan route:cache && php artisan view:cache
php artisan up
```
Bila model atau aset WASM diganti, naikkan `VERSION` di `public/sw.js` agar tablet memuat ulang cache.

## 4. Checklist pasca-deploy

- [ ] `https://domain/up` → 200
- [ ] `https://domain/hasil` tampil; header respons `/api/v1/public/results` memuat `Cache-Control: max-age=5, public`
- [ ] Respons HTML memuat `Content-Security-Policy`, `X-Frame-Options: DENY`
- [ ] `sha256sum public/models/*` sama dengan catatan di `public/models/README.md`
- [ ] `/panitia/uji-wajah` di tablet: wajah terdeteksi, waktu proses dicatat
- [ ] Cron aktif (`php artisan schedule:list`)
- [ ] `php artisan votes:verify-ledger` → VALID
- [ ] Cloudflare: aturan *Cache Rule* untuk `/models/*` & `/wasm/*` (cache lama); **bypass cache** untuk `/api/*` kecuali `/api/v1/public/results` (hormati header origin)
- [ ] Cadangkan DB (hPanel → Databases → Backups) sebelum hari-H

## 5. Catatan lingkungan

- **Apache + mod_php thread-safe di Windows (XAMPP)**: wajib `php artisan config:cache`, kalau tidak variabel `.env` bisa tertukar antar-thread (gejala: "Unknown database 'laravel'"). Ingat `php artisan config:clear` sebelum `php artisan test` (tes akan menolak berjalan bila koneksi bukan SQLite in-memory).
- Pengembangan lokal: `php artisan serve` + `npm run dev`, buka `http://127.0.0.1:8000` (kamera diizinkan di localhost tanpa HTTPS).
