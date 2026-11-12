<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Foto kandidat: disimpan di disk publik, DIPERKECIL saat diunggah (sisi terpanjang ≤ 1000 px, JPEG),
 * sehingga surat suara di bilik cepat termuat walau banyak bilik membuka foto bersamaan lewat PHP
 * di hosting bersama. Bila GD tidak tersedia / gambar tak terbaca, berkas asli disimpan apa adanya.
 */
class CandidatePhotoService
{
    public const MAX_SIDE = 1000;

    public const QUALITY = 85;

    private const DIR = 'candidates';

    /** Simpan unggahan; kembalikan path relatif di disk publik. */
    public function store(UploadedFile $file): string
    {
        $resized = $this->resize((string) file_get_contents($file->getRealPath()));
        if ($resized === null) {
            return $file->store(self::DIR, 'public');
        }

        $path = self::DIR.'/'.Str::random(40).'.jpg';
        Storage::disk('public')->put($path, $resized);

        return $path;
    }

    public function exists(?string $path): bool
    {
        return $path !== null && $path !== '' && Storage::disk('public')->exists($path);
    }

    public function delete(?string $path): void
    {
        if ($path) {
            Storage::disk('public')->delete($path);
        }
    }

    /**
     * Perkecil berkas yang sudah ada. @return array{before:int, after:int, path:string}|null  null bila tidak perlu/tak bisa.
     */
    public function optimizeExisting(string $path): ?array
    {
        $disk = Storage::disk('public');
        if (! $disk->exists($path)) {
            return null;
        }
        $bytes = (string) $disk->get($path);
        $out = $this->resize($bytes);
        if ($out === null || strlen($out) >= strlen($bytes) * 0.9) {
            return null; // sudah kecil
        }
        $new = self::DIR.'/'.Str::random(40).'.jpg';
        $disk->put($new, $out);
        $disk->delete($path);

        return ['before' => strlen($bytes), 'after' => strlen($out), 'path' => $new];
    }

    /** JPEG hasil perkecilan, atau null bila GD tak ada / gambar tak terbaca. */
    private function resize(string $bytes): ?string
    {
        if (! function_exists('imagecreatefromstring') || $bytes === '') {
            return null;
        }
        try {
            $src = @imagecreatefromstring($bytes);
            if (! $src) {
                return null;
            }
            $w = imagesx($src);
            $h = imagesy($src);
            $scale = min(1.0, self::MAX_SIDE / max($w, $h));
            $nw = max(1, (int) round($w * $scale));
            $nh = max(1, (int) round($h * $scale));

            // Latar putih agar PNG/WebP transparan tidak menjadi hitam di JPEG.
            $dst = imagecreatetruecolor($nw, $nh);
            imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
            imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);

            ob_start();
            imagejpeg($dst, null, self::QUALITY);
            $out = (string) ob_get_clean();
            imagedestroy($src);
            imagedestroy($dst);

            return $out !== '' ? $out : null;
        } catch (Throwable) {
            return null;
        }
    }
}
