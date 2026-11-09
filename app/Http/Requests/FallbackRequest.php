<?php

namespace App\Http\Requests;

use App\Models\Voter;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FallbackRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $needsIdentifier = $this->input('type') === Voter::STUDENT || ! $this->filled('name');

        return [
            'type' => ['required', Rule::in([Voter::STUDENT, Voter::TEACHER])],
            'identifier' => [Rule::requiredIf($needsIdentifier), 'nullable', 'string', 'max:30'],
            'name' => ['nullable', 'string', 'max:120'],
            'distinguisher' => ['nullable', 'string', 'max:50'],
            'birth_date' => ['required', 'date_format:Y-m-d'],
        ];
    }

    public function messages(): array
    {
        return [
            'identifier.required' => 'Nomor induk (NISN/NIP) wajib diisi.',
            'birth_date.required' => 'Tanggal lahir wajib diisi.',
            'birth_date.date_format' => 'Format tanggal lahir tidak valid.',
        ];
    }
}
