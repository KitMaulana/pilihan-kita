<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    public const ROLE_ADMIN = 'admin';

    public const ROLE_PANITIA = 'panitia';

    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'role',
        'election_id',
        'is_active',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    /** Panitia yang dibatasi ke satu sesi (sekolah). Admin selalu bisa mengakses semua sesi. */
    public function election(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(Election::class);
    }

    /** Sesi yang boleh diakses akun ini: null = semua, atau satu id sesi. */
    public function restrictedElectionId(): ?int
    {
        return $this->isAdmin() ? null : ($this->election_id ? (int) $this->election_id : null);
    }

    public function canAccessElection(?Election $election): bool
    {
        $only = $this->restrictedElectionId();

        return $election !== null && ($only === null || $only === $election->id);
    }
}
