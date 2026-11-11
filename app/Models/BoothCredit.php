<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Hak masuk bilik ANONIM: diterbitkan saat check-in, dipakai (dihapus) saat suara dikirim di bilik.
 * Tanpa voter_id / device_id / created_at; id UUIDv4 acak. Lihat migrasi add_checkin_booth_flow.
 */
class BoothCredit extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'election_id', 'expires_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(fn (BoothCredit $c) => $c->id ??= (string) Str::uuid()); // UUIDv4
    }

    public function scopeWaiting(Builder $q, int $electionId): Builder
    {
        return $q->where('election_id', $electionId)->where('expires_at', '>', now());
    }

    public function scopeExpired(Builder $q, int $electionId): Builder
    {
        return $q->where('election_id', $electionId)->where('expires_at', '<=', now());
    }
}
