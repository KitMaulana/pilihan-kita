<?php

namespace App\Http\Controllers\Kiosk;

use App\Exceptions\KioskException;
use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmRequest;
use App\Http\Requests\FallbackRequest;
use App\Http\Requests\IdentifyRequest;
use App\Http\Requests\VoteRequest;
use App\Http\Resources\CandidateResource;
use App\Models\BoothCredit;
use App\Models\Election;
use App\Models\KioskDevice;
use App\Services\FaceMatchService;
use App\Services\KioskAccessService;
use App\Services\VoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KioskController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $election = Election::current();

        return response()->json([
            'device' => ['name' => $this->device($request)->name, 'role' => $this->device($request)->role],
            'election' => $election ? [
                'name' => $election->name,
                'school_name' => $election->school_name,
                'status' => $election->status,
                'is_simulation' => $election->is_simulation,
                'is_voting_open' => $election->isVotingOpen(),
                'closed_reason' => $election->votingClosedReason(),
                'closes_at' => $election->closes_at?->toIso8601String(),
                'require_liveness' => (bool) $election->setting('require_liveness'),
            ] : null,
            'model_version' => config('security.face_model_version'),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function candidates(Request $request): JsonResponse
    {
        $election = $this->election($request);

        return response()->json([
            'data' => CandidateResource::collection($election->candidates()->where('is_active', true)->get()),
        ]);
    }

    public function identify(IdentifyRequest $request, KioskAccessService $access): JsonResponse
    {
        if ($request->input('model_version') !== config('security.face_model_version')) {
            throw new KioskException('model_mismatch', 'Versi model wajah di tablet tidak sesuai. Muat ulang halaman.', 409);
        }

        $embedding = FaceMatchService::sanitize($request->input('embedding'));
        if (! $embedding) {
            throw new KioskException('invalid_embedding', 'Data wajah tidak valid. Silakan coba lagi.');
        }

        return response()->json($access->identifyByFace(
            $this->election($request),
            $this->device($request),
            $embedding,
            (array) $request->input('liveness', []),
        ));
    }

    public function fallback(FallbackRequest $request, KioskAccessService $access): JsonResponse
    {
        return response()->json($access->identifyByFallback(
            $this->election($request),
            $this->device($request),
            $request->validated(),
        ));
    }

    public function confirm(ConfirmRequest $request, KioskAccessService $access): JsonResponse
    {
        return response()->json($access->confirm(
            $this->election($request),
            $this->device($request),
            $request->input('ticket'),
            $request->boolean('accepted'),
        ));
    }

    /**
     * Bilik: apakah ada pemilih yang sudah check-in dan belum memilih?
     * Hanya angka agregat — tidak ada identitas apa pun.
     */
    public function boothStatus(Request $request): JsonResponse
    {
        $waiting = BoothCredit::waiting($this->election($request)->id)->count();

        return response()->json(['ready' => $waiting > 0, 'waiting' => $waiting]);
    }

    public function vote(VoteRequest $request, VoteService $votes): JsonResponse
    {
        $result = $votes->cast(
            $this->election($request),
            $this->device($request),
            (int) $request->input('candidate_id'),
            $request->input('idempotency_key'),
        );

        return response()->json([
            'receipt_code' => $result['receipt_code'],
            'replayed' => $result['replayed'],
            'message' => 'Terima kasih, suara Anda sudah tercatat.',
        ], $result['replayed'] ? 200 : 201);
    }

    private function device(Request $request): KioskDevice
    {
        return $request->attributes->get('kiosk_device');
    }

    private function election(Request $request): Election
    {
        return $request->attributes->get('election');
    }
}
