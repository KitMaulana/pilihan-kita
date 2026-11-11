<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class KioskDeviceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'role' => $this->role,
            'is_active' => $this->is_active,
            'online' => $this->is_active && $this->last_seen_at && $this->last_seen_at->gt(now()->subMinutes(2)),
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'last_ip' => $this->last_ip,
            'revoked_at' => $this->revoked_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
