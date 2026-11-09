<?php

namespace App\Http\Resources;

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
        ];
    }
}
