<?php

namespace App\Http\Requests;

use App\Models\KioskDevice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class DeviceStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:60'],
            'role' => ['sometimes', Rule::in(KioskDevice::ROLES)],
        ];
    }

    public function messages(): array
    {
        return ['role.in' => 'Peran perangkat harus meja check-in atau bilik suara.'];
    }
}
