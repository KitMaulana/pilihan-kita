<?php

namespace App\Http\Requests;

use App\Models\Voter;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class VoterImportPreviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in([Voter::STUDENT, Voter::TEACHER])],
            'file' => ['required', 'file', 'max:2048', 'extensions:csv,txt'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.max' => 'Ukuran berkas maksimal 2 MB.',
            'file.extensions' => 'Berkas harus berformat CSV.',
        ];
    }
}
