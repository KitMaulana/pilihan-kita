<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AccessAttemptResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'created_at' => $this->created_at?->toIso8601String(),
            'method' => $this->method,
            'result' => $this->result,
            'reason' => $this->reason,
            'is_suspicious' => $this->is_suspicious,
            'score_top' => $this->score_top,
            'score_margin' => $this->score_margin,
            'device' => $this->device?->name,
            'voter' => $this->voter ? [
                'id' => $this->voter->id,
                'name' => $this->voter->name,
                'class_name' => $this->voter->displayClass(),
                'identifier' => $this->voter->identifier,
            ] : null,
        ];
    }
}
