<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UserStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $user = $this->route('user');

        return [
            'name' => [$user ? 'sometimes' : 'required', 'string', 'max:120'],
            'username' => ['nullable', 'string', 'min:3', 'max:40', 'regex:/^[A-Za-z0-9._-]+$/', Rule::unique('users', 'username')->ignore($user?->id)],
            'email' => [$user ? 'sometimes' : 'required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user?->id)],
            'password' => [$user ? 'nullable' : 'required', Password::min(8)],
            'role' => [$user ? 'sometimes' : 'required', Rule::in([User::ROLE_ADMIN, User::ROLE_PANITIA])],
            'is_active' => ['sometimes', 'boolean'],
            // Panitia boleh dibatasi ke satu sesi (sekolah); kosong = semua sesi. Admin selalu semua sesi.
            'election_id' => ['sometimes', 'nullable', 'integer', 'exists:elections,id'],
        ];
    }
}
