<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VoterUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:120'],
            'class_name' => ['sometimes', 'nullable', 'string', 'max:50'],
            'birth_date' => ['sometimes', 'date_format:Y-m-d', 'before:today', 'after:1940-01-01'],
            'distinguisher' => ['sometimes', 'nullable', 'string', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
