<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BallotTicket extends Model
{
    public const IDENTIFIED = 'identified';

    public const CONFIRMED = 'confirmed';

    public $timestamps = false;

    protected $fillable = ['token_hash', 'election_id', 'voter_id', 'device_id', 'method', 'stage', 'expires_at'];

    protected $hidden = ['token_hash'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime'];
    }

    public function voter(): BelongsTo
    {
        return $this->belongsTo(Voter::class);
    }
}
