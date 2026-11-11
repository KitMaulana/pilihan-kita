<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ElectionUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:150'],
            'opens_at' => ['sometimes', 'nullable', 'date'],
            'closes_at' => ['sometimes', 'nullable', 'date', 'after:opens_at'],
            'settings' => ['sometimes', 'array'],
            'settings.match_threshold' => ['sometimes', 'numeric', 'between:0.2,0.95'],
            'settings.match_margin' => ['sometimes', 'numeric', 'between:0,0.5'],
            'settings.duplicate_threshold' => ['sometimes', 'numeric', 'between:0.3,0.99'],
            'settings.max_fallback_attempts' => ['sometimes', 'integer', 'between:1,10'],
            'settings.ticket_identified_ttl' => ['sometimes', 'integer', 'between:30,600'],
            'settings.ticket_vote_ttl' => ['sometimes', 'integer', 'between:60,900'],
            'settings.booth_credit_ttl' => ['sometimes', 'integer', 'between:120,3600'],
            'settings.seal_batch_size' => ['sometimes', 'integer', 'between:1,100'],
            'settings.require_liveness' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return ['closes_at.after' => 'Jam tutup harus setelah jam buka.'];
    }
}
