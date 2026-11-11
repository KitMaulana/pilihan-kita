<?php

namespace App\Http\Resources;

use App\Models\BoothCredit;
use App\Models\Election;
use App\Services\ElectionService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ElectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'school_name' => $this->school_name,
            'slug' => $this->slug,
            'label' => $this->label(),
            'public_url' => '/hasil/'.$this->slug,
            'status' => $this->status,
            'is_simulation' => $this->is_simulation,
            'is_voting_open' => $this->isVotingOpen(),
            'closed_reason' => $this->votingClosedReason(),
            'opens_at' => $this->opens_at?->toIso8601String(),
            'closes_at' => $this->closes_at?->toIso8601String(),
            'closed_at' => $this->closed_at?->toIso8601String(),
            'published_at' => $this->published_at?->toIso8601String(),
            'settings' => $this->allSettings(),
            'ledger_count' => $this->ledger_count,
            'ledger_head_hash' => $this->ledger_head_hash,
            'allowed_transitions' => ElectionService::TRANSITIONS[$this->status] ?? [],
            // Pemilih yang sudah check-in tetapi belum memilih di bilik.
            'booth_waiting' => BoothCredit::waiting($this->id)->count(),
            'votes_count' => $votes = $this->votes()->count(),
            'voters_count' => $this->voters()->count(),
            // Multi-sekolah: sesi baru selalu boleh dibuat (admin) dan berjalan bersamaan.
            'can_create_new' => true,
            // Sesi hanya boleh dihapus bila belum ada check-in / suara.
            'can_delete' => $votes === 0 && ! \Illuminate\Support\Facades\DB::table('voter_turnouts')->where('election_id', $this->id)->exists(),
        ];
    }
}
