<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Suara dari bilik: hanya kandidat + idempotency key — tidak ada data pemilih sama sekali. */
class VoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'candidate_id' => ['required', 'integer'],
            'idempotency_key' => ['required', 'string', 'min:16', 'max:64'],
        ];
    }
}
