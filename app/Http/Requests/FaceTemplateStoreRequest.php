<?php

namespace App\Http\Requests;

use App\Models\FaceTemplate;
use Illuminate\Foundation\Http\FormRequest;

class FaceTemplateStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'voter_id' => ['required', 'integer', 'exists:voters,id'],
            'embedding' => ['required', 'array', 'size:'.FaceTemplate::DIMENSION],
            'embedding.*' => ['numeric'],
            'model_version' => ['required', 'string', 'max:50'],
            'quality_score' => ['nullable', 'numeric', 'between:0,1'],
        ];
    }

    public function messages(): array
    {
        return [
            'embedding.size' => 'Vektor wajah harus berdimensi '.FaceTemplate::DIMENSION.'.',
        ];
    }
}
