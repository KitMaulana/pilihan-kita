<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Hak masuk bilik ANONIM: diterbitkan saat check-in, dipakai (dihapus) saat suara dikirim di bilik.
 * Tanpa voter_id / device_id / created_at; id UUIDv4 acak. TIDAK hangus oleh waktu — pemilih
 * yang sudah check-in pasti memilih. `queued_at` hanya untuk urutan antrean (FIFO).
 */
class BoothCredit extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'election_id', 'queued_at'];

    protected function casts(): array
    {
        return ['queued_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(fn (BoothCredit $c) => $c->id ??= (string) Str::uuid()); // UUIDv4
    }

    /** Hak masuk yang belum dipakai (pemilih sudah check-in, belum memilih). */
    public function scopeWaiting(Builder $q, int $electionId): Builder
    {
        return $q->where('election_id', $electionId);
    }
}
