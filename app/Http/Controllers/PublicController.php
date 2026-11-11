<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReceiptCheckRequest;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Vote;
use App\Services\ResultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PublicController extends Controller
{
    /**
     * Daftar sesi (sekolah) untuk halaman publik. Hanya data umum: nama sekolah & pemilihan, status,
     * angka partisipasi agregat. Sesi draf tidak ditampilkan.
     */
    public function sessions(): JsonResponse
    {
        $rows = Election::query()
            ->where('status', '!=', Election::DRAFT)
            ->orderByRaw("CASE status WHEN 'open' THEN 0 WHEN 'closed' THEN 1 ELSE 2 END")
            ->orderByDesc('id')
            ->get()
            ->map(fn (Election $e) => [
                'slug' => $e->slug,
                'school_name' => $e->school_name,
                'name' => $e->name,
                'status' => $e->status,
                'is_voting_open' => $e->isVotingOpen(),
                'is_simulation' => $e->is_simulation,
                'opens_at' => $e->opens_at?->toIso8601String(),
                'closes_at' => $e->closes_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $rows])->header('Cache-Control', 'public, max-age=15');
    }

    /** Hasil satu sesi: ?session={slug}. Tanpa slug → sesi yang sedang dibuka / terbaru (kompatibel tautan lama). */
    public function results(Request $request, ResultService $results): JsonResponse
    {
        $slug = (string) $request->query('session', '');
        $election = $slug !== ''
            ? Election::where('slug', $slug)->where('status', '!=', Election::DRAFT)->first()
            : (Election::where('status', Election::OPEN)->orderByDesc('id')->first()
                ?? Election::where('status', '!=', Election::DRAFT)->orderByDesc('id')->first());

        if (! $election) {
            return response()->json(['election' => null, 'message' => $slug !== '' ? 'Sesi tidak ditemukan.' : 'Belum ada pemilihan.'], $slug !== '' ? 404 : 200)
                ->header('Cache-Control', 'public, max-age=5');
        }

        return response()->json($results->snapshot($election))
            ->header('Cache-Control', 'public, max-age='.ResultService::TTL);
    }

    /**
     * Foto kandidat dilayani lewat PHP agar tidak bergantung pada symlink `public/storage`
     * (sering gagal dibuat di hosting bersama) maupun APP_URL. Foto kandidat bersifat publik.
     */
    public function candidatePhoto(Candidate $candidate): StreamedResponse
    {
        $disk = Storage::disk('public');
        abort_unless($candidate->photo_path && $disk->exists($candidate->photo_path), 404);

        return $disk->response($candidate->photo_path, null, [
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /**
     * Cek resi: HANYA menjawab "tercatat" — tidak pernah menampilkan pilihan
     * (mencegah paksaan / jual-beli suara).
     */
    public function receipt(ReceiptCheckRequest $request): JsonResponse
    {
        $vote = Vote::where('receipt_code', $request->input('code'))->first(['seq', 'election_id']);

        if (! $vote) {
            return response()->json([
                'recorded' => false,
                'message' => 'Kode resi tidak ditemukan. Periksa kembali penulisannya.',
            ]);
        }

        return response()->json([
            'recorded' => true,
            'sealed' => $vote->seq !== null,
            'message' => $vote->seq !== null
                ? 'Suara dengan kode ini tercatat dan sudah tersegel di ledger.'
                : 'Suara dengan kode ini tercatat dan sedang menunggu penyegelan ledger.',
        ]);
    }
}
