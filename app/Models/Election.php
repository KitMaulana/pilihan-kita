<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Election extends Model
{
    public const DRAFT = 'draft';

    public const OPEN = 'open';

    public const CLOSED = 'closed';

    public const PUBLISHED = 'published';

    /** Nilai bawaan pengaturan. Ambang & margin WAJIB dikalibrasi lewat uji Fase 3. */
    public const DEFAULT_SETTINGS = [
        'match_threshold' => 0.50,   // cosine minimal skor tertinggi
        'match_margin' => 0.08,      // selisih minimal s1 - s2
        'duplicate_threshold' => 0.70, // dua pemilih dianggap "wajah ganda" bila >= ini
        'max_fallback_attempts' => 3,
        'ticket_identified_ttl' => 120, // detik untuk menekan Ya/Tidak
        'ticket_vote_ttl' => 180,       // detik untuk memilih kandidat
        'seal_batch_size' => 10,        // suara disegel & diacak per kelompok
        'require_liveness' => true,
    ];

    protected $fillable = [
        'name', 'status', 'opens_at', 'closes_at', 'settings', 'is_simulation',
        'ledger_head_hash', 'ledger_count', 'closed_at', 'published_at',
    ];

    protected function casts(): array
    {
        return [
            'opens_at' => 'datetime',
            'closes_at' => 'datetime',
            'closed_at' => 'datetime',
            'published_at' => 'datetime',
            'settings' => 'array',
            'is_simulation' => 'boolean',
            'ledger_count' => 'integer',
        ];
    }

    public function candidates(): HasMany
    {
        return $this->hasMany(Candidate::class)->orderBy('number');
    }

    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }

    /** Pemilihan aktif = yang terbaru (simulasi atau nyata). */
    public static function current(): ?self
    {
        return static::query()->latest('id')->first();
    }

    public function scopeReal(Builder $q): Builder
    {
        return $q->where('is_simulation', false);
    }

    public function setting(string $key): mixed
    {
        return ($this->settings ?? [])[$key] ?? self::DEFAULT_SETTINGS[$key] ?? null;
    }

    public function allSettings(): array
    {
        return array_merge(self::DEFAULT_SETTINGS, $this->settings ?? []);
    }

    /** Voting terbuka = status open DAN berada di jendela waktu (bila diatur). */
    public function isVotingOpen(?Carbon $now = null): bool
    {
        $now ??= now();

        if ($this->status !== self::OPEN) {
            return false;
        }
        if ($this->opens_at && $now->lt($this->opens_at)) {
            return false;
        }
        if ($this->closes_at && $now->gte($this->closes_at)) {
            return false;
        }

        return true;
    }

    public function votingClosedReason(?Carbon $now = null): ?string
    {
        $now ??= now();

        return match (true) {
            $this->status === self::DRAFT => 'Pemilihan belum dibuka.',
            in_array($this->status, [self::CLOSED, self::PUBLISHED]) => 'Pemilihan sudah ditutup.',
            $this->opens_at && $now->lt($this->opens_at) => 'Pemilihan belum dimulai.',
            $this->closes_at && $now->gte($this->closes_at) => 'Waktu pemilihan sudah berakhir.',
            default => null,
        };
    }
}
