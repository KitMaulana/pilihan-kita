<?php

namespace App\Http\Requests;

use App\Models\FaceTemplate;
use Illuminate\Foundation\Http\FormRequest;

class IdentifyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'embedding' => ['required', 'array', 'size:'.FaceTemplate::DIMENSION],
            'embedding.*' => ['numeric'],
            'model_version' => ['required', 'string', 'max:50'],
            'liveness' => ['present', 'array'],
            'liveness.passed' => ['sometimes', 'boolean'],
            'liveness.challenges' => ['sometimes', 'array', 'max:5'],
            'liveness.challenges.*' => ['string', 'max:20'],
        ];
    }
}
