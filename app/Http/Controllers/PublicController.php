<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReceiptCheckRequest;
use App\Models\Election;
use App\Models\Vote;
use App\Services\ResultService;
use Illuminate\Http\JsonResponse;

class PublicController extends Controller
{
    public function results(ResultService $results): JsonResponse
    {
        $election = Election::current();
        if (! $election) {
            return response()->json(['election' => null, 'message' => 'Belum ada pemilihan.'])
                ->header('Cache-Control', 'public, max-age=5');
        }

        return response()->json($results->snapshot($election))
            ->header('Cache-Control', 'public, max-age='.ResultService::TTL);
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
