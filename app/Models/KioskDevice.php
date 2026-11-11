<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class KioskDevice extends Model
{
    /** Meja check-in: scan wajah / NISN, tahu identitas pemilih, TIDAK bisa memungut suara. */
    public const CHECKIN = 'checkin';

    /** Bilik suara: hanya menampilkan surat suara, TIDAK pernah tahu identitas pemilih. */
    public const BOOTH = 'booth';

    public const ROLES = [self::CHECKIN, self::BOOTH];

    protected $attributes = ['role' => self::CHECKIN];

    protected $fillable = ['name', 'role', 'token_hash', 'is_active', 'last_seen_at', 'last_ip', 'revoked_at', 'created_by'];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'last_seen_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public static function hashToken(string $plain): string
    {
        return hash('sha256', $plain);
    }

    /**
     * Membuat perangkat baru. Token polos hanya dikembalikan SEKALI.
     *
     * @return array{0: self, 1: string}
     */
    public static function register(string $name, ?int $userId = null, string $role = self::CHECKIN): array
    {
        $plain = 'kd_'.Str::random(48);
        $device = static::create([
            'name' => $name,
            'role' => $role,
            'token_hash' => static::hashToken($plain),
            'is_active' => true,
            'created_by' => $userId,
        ]);

        return [$device, $plain];
    }

    public static function findByToken(?string $plain): ?self
    {
        if (! $plain || strlen($plain) > 100) {
            return null;
        }

        return static::where('token_hash', static::hashToken($plain))->first();
    }
}
