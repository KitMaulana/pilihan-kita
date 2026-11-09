<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Voter extends Model
{
    use HasFactory;

    public const STUDENT = 'student';

    public const TEACHER = 'teacher';

    /** Lihat migrasi: tanpa updated_at demi kerahasiaan waktu memilih. */
    public const UPDATED_AT = null;

    protected $fillable = [
        'type', 'identifier', 'name', 'class_name', 'birth_date', 'distinguisher',
        'is_active', 'is_simulation',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date:Y-m-d',
            'is_active' => 'boolean',
            'has_voted' => 'boolean',
            'is_simulation' => 'boolean',
            'locked_at' => 'datetime',
            'failed_attempts' => 'integer',
        ];
    }

    public function faceTemplate(): HasOne
    {
        return $this->hasOne(FaceTemplate::class);
    }

    public function isLocked(): bool
    {
        return $this->locked_at !== null;
    }

    /** Label kelas untuk layar konfirmasi. */
    public function displayClass(): string
    {
        if ($this->type === self::TEACHER) {
            return $this->class_name ?: 'Guru';
        }

        return (string) $this->class_name;
    }

    public function scopeSearch(Builder $q, ?string $term): Builder
    {
        if (! $term) {
            return $q;
        }

        return $q->where(function (Builder $w) use ($term) {
            $w->where('name', 'like', "%{$term}%")
                ->orWhere('identifier', 'like', "{$term}%")
                ->orWhere('class_name', 'like', "%{$term}%");
        });
    }
}
