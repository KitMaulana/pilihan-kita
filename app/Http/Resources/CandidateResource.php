<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CandidateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'position' => $this->position ?? 'pair',
            'position_label' => \App\Models\Election::POSITION_LABELS[$this->position ?? 'pair'] ?? null,
            'number' => $this->number,
            'name' => $this->name,
            'class_name' => $this->class_name,
            'photo_url' => $this->photoUrl(),
            'vision' => $this->vision,
            'mission' => $this->mission,
            'is_active' => $this->is_active,
        ];
    }
}
