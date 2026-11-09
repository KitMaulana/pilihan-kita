<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ReceiptCheckRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $raw = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $this->input('code')));
        if (strlen($raw) === 10) {
            $raw = substr($raw, 0, 4).'-'.substr($raw, 4, 4).'-'.substr($raw, 8, 2);
        }
        $this->merge(['code' => $raw]);
    }

    public function rules(): array
    {
        return ['code' => ['required', 'string', 'regex:/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{2}$/']];
    }

    public function messages(): array
    {
        return ['code.regex' => 'Format kode resi: XXXX-XXXX-XX.'];
    }
}
