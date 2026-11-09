<?php

namespace App\Http\Requests;

use App\Models\Election;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Konfirmasi ganda: selain tombol, panitia harus mengetik kata kunci status tujuan. */
class ElectionStatusRequest extends FormRequest
{
    public const CONFIRM_WORDS = [
        Election::OPEN => 'BUKA',
        Election::CLOSED => 'TUTUP',
        Election::PUBLISHED => 'PUBLIKASI',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in(array_keys(self::CONFIRM_WORDS))],
            'confirm' => ['required', 'string', function ($attr, $value, $fail) {
                $expected = self::CONFIRM_WORDS[$this->input('status')] ?? null;
                if ($expected && mb_strtoupper(trim((string) $value)) !== $expected) {
                    $fail('Ketik "'.$expected.'" untuk mengonfirmasi.');
                }
            }],
        ];
    }
}
