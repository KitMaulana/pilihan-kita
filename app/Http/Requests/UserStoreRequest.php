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
            'email' => [$user ? 'sometimes' : 'required', 'email', 'max:190', Rule::unique('users', 'email')->ignore($user?->id)],
            'password' => [$user ? 'nullable' : 'required', Password::min(8)],
            'role' => [$user ? 'sometimes' : 'required', Rule::in([User::ROLE_ADMIN, User::ROLE_PANITIA])],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
