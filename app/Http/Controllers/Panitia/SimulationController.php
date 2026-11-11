<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Models\Election;
use App\Services\SimulationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SimulationController extends Controller
{
    public function store(Request $request, SimulationService $sim): JsonResponse
    {
        $request->validate([
            'voters' => ['required', 'integer', 'between:1,2000'],
            'candidates' => ['sometimes', 'integer', 'between:2,5'],
        ]);

        // Multi-sekolah: simulasi = sesi tersendiri, terpisah dari sesi nyata yang mungkin sedang berjalan.
        $current = Election::current();
        $school = $current && ! $current->is_simulation ? $current->school_name : null;

        // Simulasi dari panel: tanpa wajah (vektor acak tidak berguna untuk tablet sungguhan);
        // gladi dilakukan lewat jalur cadangan atau dengan mendaftarkan wajah relawan ke pemilih simulasi.
        $result = $sim->create($request->integer('voters'), $request->integer('candidates', 3), withFaces: false, school: $school);

        return response()->json([
            'election_id' => $result['election']->id,
            'voters' => $result['voters'],
            'message' => "Simulasi dibuat dengan {$result['voters']} pemilih palsu (tanggal lahir 2008-01-01).",
        ], 201);
    }

    public function destroy(Request $request, SimulationService $sim): JsonResponse
    {
        $request->validate(['confirm' => ['required', 'in:HAPUS SIMULASI']], ['confirm.in' => 'Ketik "HAPUS SIMULASI" untuk mengonfirmasi.']);

        return response()->json(['deleted' => $sim->purge(), 'message' => 'Semua data simulasi telah dihapus.']);
    }
}
