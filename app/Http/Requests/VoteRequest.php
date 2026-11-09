<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class VoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'vote_token' => ['required', 'string', 'size:48'],
            'candidate_id' => ['required', 'integer'],
            'idempotency_key' => ['required', 'string', 'min:16', 'max:64'],
        ];
    }
}
