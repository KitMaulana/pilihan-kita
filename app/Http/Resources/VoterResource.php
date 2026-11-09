<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Untuk panel panitia saja. Tidak pernah memuat vektor wajah. */
class VoterResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $tpl = $this->whenLoaded('faceTemplate');

        return [
            'id' => $this->id,
            'type' => $this->type,
            'identifier' => $this->identifier,
            'name' => $this->name,
            'class_name' => $this->class_name,
            'birth_date' => $this->birth_date?->format('Y-m-d'),
            'distinguisher' => $this->distinguisher,
            'is_active' => $this->is_active,
            'has_voted' => $this->has_voted,
            'is_locked' => $this->locked_at !== null,
            'failed_attempts' => $this->failed_attempts,
            'is_simulation' => $this->is_simulation,
            'face' => $this->relationLoaded('faceTemplate') ? ($tpl ? [
                'registered' => true,
                'model_version' => $tpl->model_version,
                'quality_score' => $tpl->quality_score,
                'duplicate_of_voter_id' => $tpl->duplicate_of_voter_id,
                'duplicate_score' => $tpl->duplicate_score,
                'updated_at' => $tpl->updated_at?->toIso8601String(),
            ] : ['registered' => false]) : null,
        ];
    }
}
