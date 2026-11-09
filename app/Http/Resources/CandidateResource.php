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
