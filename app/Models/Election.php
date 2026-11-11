<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

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
        'ticket_vote_ttl' => 180,       // (tidak dipakai lagi sejak alur check-in → bilik)
        'seal_batch_size' => 10,        // suara disegel ke ledger & diacak urutannya per kelompok
        'require_liveness' => true,
    ];

    protected $fillable = [
        'name', 'school_name', 'slug', 'status', 'opens_at', 'closes_at', 'settings', 'is_simulation',
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

    /** Kunci kontainer untuk sesi aktif pada request berjalan (lihat useCurrent). */
    public const CONTAINER_KEY = 'election.current';

    /**
     * SESI AKTIF pada request ini.
     *  - panel panitia : sesi yang dipilih (header X-Session-Id) / sesi akun panitia → middleware panitia.session
     *  - tablet kiosk  : sesi tempat perangkat didaftarkan → middleware kiosk.device
     *  - tanpa konteks (perintah konsol): sesi terbaru.
     */
    public static function current(): ?self
    {
        if (app()->bound(self::CONTAINER_KEY)) {
            return app(self::CONTAINER_KEY);
        }

        return static::query()->latest('id')->first();
    }

    /** Menetapkan sesi aktif untuk sisa request (null = sengaja tidak ada sesi). */
    public static function useCurrent(?self $election): void
    {
        app()->instance(self::CONTAINER_KEY, $election);
    }

    public static function forgetCurrent(): void
    {
        app()->forgetInstance(self::CONTAINER_KEY);
    }

    public function voters(): HasMany
    {
        return $this->hasMany(Voter::class);
    }

    public function devices(): HasMany
    {
        return $this->hasMany(KioskDevice::class);
    }

    /** Label tampilan: "SMAN 1 Ciruas — Pemilihan Ketua OSIS 2026/2027". */
    public function label(): string
    {
        return trim(($this->school_name ? $this->school_name.' — ' : '').$this->name);
    }

    public static function makeSlug(string $school, ?int $exceptId = null): string
    {
        $base = Str::slug($school) ?: 'sesi';
        $base = Str::limit($base, 60, '');
        $slug = $base;
        for ($i = 2; static::where('slug', $slug)->when($exceptId, fn ($q) => $q->whereKeyNot($exceptId))->exists(); $i++) {
            $slug = $base.'-'.$i;
        }

        return $slug;
    }

    protected static function booted(): void
    {
        static::creating(function (Election $e) {
            $e->school_name ??= 'Sekolah';
            $e->slug ??= static::makeSlug($e->school_name.($e->is_simulation ? ' simulasi' : ''));
        });
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
