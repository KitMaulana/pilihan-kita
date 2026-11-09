<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Requests\FaceTemplateStoreRequest;
use App\Models\Election;
use App\Models\FaceTemplate;
use App\Models\Voter;
use App\Services\FaceMatchService;
use App\Services\FaceTemplateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class FaceTemplateController extends Controller
{
    /** Ringkasan progres pendaftaran wajah "x dari N". */
    public function status(): JsonResponse
    {
        $sim = (bool) Election::current()?->is_simulation;
        $active = Voter::where('is_simulation', $sim)->where('is_active', true);

        $total = (clone $active)->count();
        $registered = FaceTemplate::whereIn('voter_id', (clone $active)->select('id'))->count();

        return response()->json([
            'total' => $total,
            'registered' => $registered,
            'missing' => $total - $registered,
            'duplicates' => FaceTemplate::whereNotNull('duplicate_of_voter_id')->count(),
            'model_version' => config('security.face_model_version'),
        ]);
    }

    /**
     * Mencocokkan nama berkas foto (NISN/NIP atau "id-123") dengan pemilih
     * sebelum foto diproses di browser.
     */
    public function lookup(Request $request): JsonResponse
    {
        $request->validate([
            'keys' => ['required', 'array', 'max:2000'],
            'keys.*' => ['string', 'max:40'],
        ]);

        $sim = (bool) Election::current()?->is_simulation;
        $keys = collect($request->input('keys'))->map(fn ($k) => trim($k))->unique();
        $ids = $keys->filter(fn ($k) => preg_match('/^id-\d+$/i', $k))->map(fn ($k) => (int) substr($k, 3));
        $identifiers = $keys->reject(fn ($k) => preg_match('/^id-\d+$/i', $k))->map(fn ($k) => preg_replace('/[\s.\-]/', '', $k));

        $voters = Voter::with('faceTemplate')->where('is_simulation', $sim)
            ->where(fn ($q) => $q->whereIn('identifier', $identifiers->values())->orWhereIn('id', $ids->values()))
            ->get();

        $map = [];
        foreach ($voters as $v) {
            $entry = [
                'id' => $v->id,
                'name' => $v->name,
                'class_name' => $v->displayClass(),
                'has_face' => $v->faceTemplate !== null,
            ];
            if ($v->identifier) {
                $map[$v->identifier] = $entry;
            }
            $map['id-'.$v->id] = $entry;
        }

        return response()->json(['data' => $map]);
    }

    public function store(FaceTemplateStoreRequest $request, FaceTemplateService $service): JsonResponse
    {
        if ($request->input('model_version') !== config('security.face_model_version')) {
            throw ValidationException::withMessages(['model_version' => 'Versi model tidak sesuai dengan konfigurasi server ('.config('security.face_model_version').').']);
        }

        $embedding = FaceMatchService::sanitize($request->input('embedding'));
        if (! $embedding) {
            throw ValidationException::withMessages(['embedding' => 'Vektor wajah tidak valid (harus ternormalisasi, norma ≈ 1).']);
        }

        $voter = Voter::findOrFail($request->integer('voter_id'));
        $result = $service->store($voter, $embedding, $request->input('model_version'), $request->input('quality_score'));

        return response()->json([
            'voter_id' => $voter->id,
            'registered' => true,
            'duplicate' => $result['duplicate'],
            'message' => $result['duplicate']
                ? 'Tersimpan, tetapi wajah sangat mirip dengan '.$result['duplicate']['name'].'. Periksa kembali fotonya.'
                : 'Template wajah tersimpan.',
        ], 201);
    }

    public function destroy(Voter $voter, FaceTemplateService $service): JsonResponse
    {
        $service->delete($voter);

        return response()->json(['message' => 'Template wajah dihapus.']);
    }

    /** Penghapusan semua template (retensi pasca-pemilihan). Hanya admin + konfirmasi teks. */
    public function purge(Request $request, FaceTemplateService $service): JsonResponse
    {
        $request->validate(['confirm' => ['required', 'in:HAPUS SEMUA WAJAH']], [
            'confirm.in' => 'Ketik "HAPUS SEMUA WAJAH" untuk mengonfirmasi.',
        ]);
        $count = $service->purgeAll();

        return response()->json(['deleted' => $count, 'message' => "{$count} template wajah dihapus permanen."]);
    }
}
