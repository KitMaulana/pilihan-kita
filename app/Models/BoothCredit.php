<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Hak masuk bilik ANONIM: diterbitkan saat check-in, dipakai (dihapus) saat suara dikirim di bilik.
 * Tanpa voter_id / created_at; id UUIDv4 acak. TIDAK hangus oleh waktu — pemilih yang sudah
 * check-in pasti memilih. `queued_at` hanya untuk urutan antrean (FIFO).
 *
 * `claimed_by` = perangkat BILIK yang sedang memesannya (surat suara tampil di bilik itu).
 * Pesanan dilepas bila bilik tidak terlihat > CLAIM_STALE_SECONDS (bilik mati / ditinggalkan);
 * itu batas waktu untuk PERANGKAT, bukan untuk pemilih.
 */
class BoothCredit extends Model
{
    /** Bilik yang tidak mengirim detak > ini dianggap mati; pesanannya kembali ke antrean. */
    public const CLAIM_STALE_SECONDS = 120;

    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'election_id', 'claimed_by', 'queued_at'];

    protected function casts(): array
    {
        return ['queued_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::creating(fn (BoothCredit $c) => $c->id ??= (string) Str::uuid()); // UUIDv4
    }

    /** Semua hak masuk yang belum terpakai (pemilih sudah check-in, belum memilih). */
    public function scopeWaiting(Builder $q, int $electionId): Builder
    {
        return $q->where('election_id', $electionId);
    }

    /** Masih antre: belum dipesan bilik mana pun. */
    public function scopeUnclaimed(Builder $q, int $electionId): Builder
    {
        return $q->where('election_id', $electionId)->whereNull('claimed_by');
    }

    /** Sudah dipesan bilik (surat suara sedang tampil di bilik itu). */
    public function scopeClaimed(Builder $q, int $electionId): Builder
    {
        return $q->where('election_id', $electionId)->whereNotNull('claimed_by');
    }

    public function scopeHeldBy(Builder $q, int $electionId, int $deviceId): Builder
    {
        return $q->where('election_id', $electionId)->where('claimed_by', $deviceId);
    }

    /** Lepas pesanan milik bilik yang sudah tidak terlihat (mati, dicabut, atau belum pernah terlihat). */
    public static function releaseStale(int $electionId): int
    {
        $cutoff = now()->subSeconds(self::CLAIM_STALE_SECONDS);

        return static::claimed($electionId)
            ->whereIn('claimed_by', KioskDevice::query()
                ->where(fn ($q) => $q->where('is_active', false)->orWhereNull('last_seen_at')->orWhere('last_seen_at', '<', $cutoff))
                ->select('id'))
            ->update(['claimed_by' => null]);
    }
}
