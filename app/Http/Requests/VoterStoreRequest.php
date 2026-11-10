<?php

namespace App\Http\Requests;

use App\Models\Voter;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Input pemilih satu per satu (aturan sama dengan impor CSV, lihat VoterImportService). */
class VoterStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $clean = fn ($v) => is_string($v) ? trim(preg_replace('/\s+/', ' ', $v)) : $v;
        $this->merge([
            // NISN/NIP: buang spasi, titik, tanda hubung yang sering ikut tersalin.
            'identifier' => is_string($this->input('identifier')) ? preg_replace('/[\s.\-]/', '', $this->input('identifier')) : $this->input('identifier'),
            'name' => $clean($this->input('name')),
            'class_name' => $clean($this->input('class_name')),
            'distinguisher' => $clean($this->input('distinguisher')),
        ]);
    }

    public function rules(): array
    {
        $student = $this->input('type') === Voter::STUDENT;

        return [
            'type' => ['required', Rule::in([Voter::STUDENT, Voter::TEACHER])],
            'identifier' => $student
                ? ['required', 'regex:/^\d{10}$/']
                : ['nullable', 'regex:/^\d{18}$/'],
            'name' => ['required', 'string', 'max:120'],
            'class_name' => [$student ? 'required' : 'nullable', 'string', 'max:50'],
            'birth_date' => ['required', 'date_format:Y-m-d', 'before:today', 'after:1940-01-01'],
            'distinguisher' => ['nullable', 'string', 'max:50'],
        ];
    }

    public function messages(): array
    {
        $student = $this->input('type') === Voter::STUDENT;

        return [
            'identifier.required' => 'NISN wajib diisi.',
            'identifier.regex' => $student ? 'NISN harus 10 digit angka.' : 'NIP harus 18 digit angka (atau kosongkan bila tidak punya NIP).',
            'class_name.required' => 'Kelas wajib diisi untuk siswa.',
            'birth_date.before' => 'Tanggal lahir harus sebelum hari ini.',
            'birth_date.after' => 'Tanggal lahir tidak valid.',
        ];
    }
}
