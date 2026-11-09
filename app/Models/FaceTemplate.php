<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * DATA BIOMETRIK. Kolom `embedding` disembunyikan dari serialisasi apa pun.
 * Jangan log, jangan kirim ke tablet, jangan ekspor.
 */
class FaceTemplate extends Model
{
    public const DIMENSION = 512;

    protected $fillable = [
        'voter_id', 'embedding', 'model_version', 'quality_score',
        'duplicate_of_voter_id', 'duplicate_score',
    ];

    protected $hidden = ['embedding'];

    protected function casts(): array
    {
        return [
            'quality_score' => 'float',
            'duplicate_score' => 'float',
        ];
    }

    public function voter(): BelongsTo
    {
        return $this->belongsTo(Voter::class);
    }

    public function duplicateOf(): BelongsTo
    {
        return $this->belongsTo(Voter::class, 'duplicate_of_voter_id');
    }

    /** @param  float[]  $vector */
    public static function pack(array $vector): string
    {
        return pack('g*', ...$vector);
    }

    /** @return float[] 0-indexed */
    public static function unpack(string $blob): array
    {
        return array_values(unpack('g*', $blob));
    }
}
