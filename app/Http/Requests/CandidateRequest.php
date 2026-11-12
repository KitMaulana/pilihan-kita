<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CandidateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Data multipart datang sebagai teks. Nomor urut seperti "01", " 2 " atau "3.0"
     * dinormalisasi menjadi bilangan bulat agar tidak ditolak validator `integer`.
     */
    protected function prepareForValidation(): void
    {
        if ($this->has('number')) {
            $raw = trim((string) $this->input('number'));
            if (preg_match('/^\d+(?:[.,]0+)?$/', $raw)) {
                $this->merge(['number' => (int) $raw]);
            }
        }
        foreach (['name', 'class_name'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim(preg_replace('/\s+/', ' ', $this->input($field)))]);
            }
        }
    }

    public function rules(): array
    {
        $creating = ! $this->route('candidate');

        return [
            'number' => [$creating ? 'required' : 'sometimes', 'integer', 'between:1,99'],
            // Jabatan: pair (skema berpasangan) atau ketua / wakil (skema terpisah). Dicek terhadap skema sesi di controller.
            'position' => ['sometimes', 'string', 'in:pair,ketua,wakil'],
            'name' => [$creating ? 'required' : 'sometimes', 'string', 'max:150'],
            'class_name' => ['nullable', 'string', 'max:50'],
            'vision' => ['nullable', 'string', 'max:2000'],
            'mission' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
            'photo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'remove_photo' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'number.required' => 'Nomor urut wajib diisi.',
            'number.integer' => 'Nomor urut harus berupa angka bulat (mis. 1, 2, 3).',
            'number.between' => 'Nomor urut harus antara 1 dan 99.',
            'name.required' => 'Nama kandidat wajib diisi.',
            'name.max' => 'Nama kandidat maksimal 150 karakter.',
            'class_name.max' => 'Kelas maksimal 50 karakter.',
            'vision.max' => 'Visi maksimal 2.000 karakter.',
            'mission.max' => 'Misi maksimal 5.000 karakter.',
            'photo.uploaded' => 'Foto gagal diunggah (ukuran melebihi batas server). Gunakan foto maks. 2 MB.',
            'photo.file' => 'Foto gagal diunggah. Coba pilih ulang berkasnya.',
            'photo.mimes' => 'Server hanya menerima JPG, PNG, atau WebP. Halaman Kandidat otomatis mengonversi HEIC dan format lain; bila mengunggah dengan cara lain, ubah ke JPG terlebih dahulu.',
            'photo.max' => 'Ukuran foto maksimal 2 MB.',
        ];
    }
}
