<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Candidate extends Model
{
    protected $fillable = [
        'election_id', 'position', 'number', 'name', 'class_name', 'photo_path', 'vision', 'mission', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'number' => 'integer',
        ];
    }

    public function election(): BelongsTo
    {
        return $this->belongsTo(Election::class);
    }

    public function photoUrl(): ?string
    {
        // Jalur relatif + versi (berubah saat foto diganti): aman dari APP_URL yang salah,
        // tidak butuh symlink public/storage, dan tidak tertahan cache lama.
        return $this->photo_path
            ? '/api/v1/public/candidates/'.$this->id.'/photo?v='.substr(md5($this->photo_path), 0, 10)
            : null;
    }
}
