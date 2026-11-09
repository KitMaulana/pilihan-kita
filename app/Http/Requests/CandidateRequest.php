<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CandidateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $creating = ! $this->route('candidate');

        return [
            'number' => [$creating ? 'required' : 'sometimes', 'integer', 'between:1,99'],
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:150'],
            'class_name' => ['nullable', 'string', 'max:50'],
            'vision' => ['nullable', 'string', 'max:2000'],
            'mission' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'remove_photo' => ['sometimes', 'boolean'],
        ];
    }
}
