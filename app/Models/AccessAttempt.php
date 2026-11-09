<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessAttempt extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'election_id', 'voter_id', 'device_id', 'method', 'result', 'reason',
        'is_suspicious', 'score_top', 'score_margin', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'is_suspicious' => 'boolean',
            'score_top' => 'float',
            'score_margin' => 'float',
            'created_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // §6.2: created_at dibulatkan ke menit.
        static::creating(function (AccessAttempt $a) {
            $a->created_at = now()->startOfMinute();
        });
    }

    public function voter(): BelongsTo
    {
        return $this->belongsTo(Voter::class);
    }

    public function device(): BelongsTo
    {
        return $this->belongsTo(KioskDevice::class, 'device_id');
    }
}
