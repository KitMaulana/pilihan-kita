<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CandidateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Berkas foto bisa hilang dari server (mis. folder storage tergantikan saat deploy): jangan kirim URL rusak.
        $missing = $this->photo_path && ! app(\App\Services\CandidatePhotoService::class)->exists($this->photo_path);

        return [
            'id' => $this->id,
            'position' => $this->position ?? 'pair',
            'position_label' => \App\Models\Election::POSITION_LABELS[$this->position ?? 'pair'] ?? null,
            'number' => $this->number,
            'name' => $this->name,
            'class_name' => $this->class_name,
            'photo_url' => $missing ? null : $this->photoUrl(),
            'photo_missing' => (bool) $missing,
            'vision' => $this->vision,
            'mission' => $this->mission,
            'is_active' => $this->is_active,
        ];
    }
}
