<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * Suara rahasia: tidak ada voter_id, tidak ada timestamp, id = UUIDv4 acak.
 * (Sengaja TIDAK memakai trait HasUuids karena Laravel 12 menghasilkan UUIDv7
 * yang memuat waktu pembuatan.)
 */
class Vote extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'election_id', 'candidate_id', 'receipt_code', 'nonce', 'seq', 'prev_hash', 'hash'];

    protected static function booted(): void
    {
        static::creating(function (Vote $vote) {
            $vote->id ??= (string) Str::uuid(); // Str::uuid() = UUIDv4 acak
        });
    }

    public function candidate(): BelongsTo
    {
        return $this->belongsTo(Candidate::class);
    }
}
