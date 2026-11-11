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
            'school_name' => ['sometimes', 'string', 'max:150'],
            // Tautan publik /hasil/{slug}; huruf kecil, angka, tanda hubung.
            'slug' => ['sometimes', 'string', 'min:3', 'max:80', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/',
                \Illuminate\Validation\Rule::unique('elections', 'slug')->ignore(\App\Models\Election::current()?->id)],
            'opens_at' => ['sometimes', 'nullable', 'date'],
            'closes_at' => ['sometimes', 'nullable', 'date', 'after:opens_at'],
            'settings' => ['sometimes', 'array'],
            'settings.match_threshold' => ['sometimes', 'numeric', 'between:0.2,0.95'],
            'settings.match_margin' => ['sometimes', 'numeric', 'between:0,0.5'],
            'settings.duplicate_threshold' => ['sometimes', 'numeric', 'between:0.3,0.99'],
            'settings.max_fallback_attempts' => ['sometimes', 'integer', 'between:1,10'],
            'settings.ticket_identified_ttl' => ['sometimes', 'integer', 'between:30,600'],
            'settings.ticket_vote_ttl' => ['sometimes', 'integer', 'between:60,900'],
            'settings.seal_batch_size' => ['sometimes', 'integer', 'between:1,100'],
            'settings.require_liveness' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'closes_at.after' => 'Jam tutup harus setelah jam buka.',
            'slug.regex' => 'Tautan hanya boleh huruf kecil, angka, dan tanda hubung (mis. sman-1-ciruas).',
            'slug.unique' => 'Tautan ini sudah dipakai sesi lain.',
        ];
    }
}
