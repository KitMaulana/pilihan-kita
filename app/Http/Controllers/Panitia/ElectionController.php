<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Requests\ElectionStatusRequest;
use App\Http\Requests\ElectionUpdateRequest;
use App\Http\Resources\ElectionResource;
use App\Models\Election;
use App\Services\AuditService;
use App\Services\ElectionService;
use App\Services\LedgerService;
use App\Services\ResultService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

class ElectionController extends Controller
{
    public function show(): JsonResponse
    {
        $election = Election::current();

        return response()->json(['data' => $election ? new ElectionResource($election) : null]);
    }

    public function store(Request $request, AuditService $audit): JsonResponse
    {
        $request->validate(['name' => ['required', 'string', 'max:150']]);

        $current = Election::current();
        $closedEmpty = $current && $current->status === Election::CLOSED && ! $current->votes()->exists();
        if ($current && ! $current->is_simulation && $current->status !== Election::PUBLISHED && ! $closedEmpty) {
            throw ValidationException::withMessages(['name' => 'Masih ada pemilihan yang belum ditutup/dipublikasikan.']);
        }

        $election = Election::create([
            'name' => $request->input('name'),
            'status' => Election::DRAFT,
            'settings' => Election::DEFAULT_SETTINGS,
        ]);
        $audit->log('election.created', $election, ['name' => $election->name]);

        return response()->json(['data' => new ElectionResource($election)], 201);
    }

    public function update(ElectionUpdateRequest $request, AuditService $audit, ResultService $results): ElectionResource
    {
        $election = Election::current() ?? abort(404, 'Belum ada pemilihan.');
        if ($election->status === Election::PUBLISHED) {
            throw ValidationException::withMessages(['election' => 'Pemilihan yang sudah dipublikasikan tidak dapat diubah.']);
        }

        $data = $request->validated();
        foreach (['opens_at', 'closes_at'] as $field) {
            if (array_key_exists($field, $data)) {
                // Input dari panel selalu memuat offset (+07:00); simpan sebagai UTC.
                $data[$field] = $data[$field] ? Carbon::parse($data[$field])->utc() : null;
            }
        }
        if (isset($data['settings'])) {
            if ($election->status !== Election::DRAFT && ! $request->user()->isAdmin()) {
                throw ValidationException::withMessages(['settings' => 'Pengaturan hanya bisa diubah admin setelah pemilihan dibuka.']);
            }
            $data['settings'] = array_merge($election->allSettings(), $data['settings']);
        }

        $election->fill($data)->save();
        $results->forget($election);
        $audit->log('election.updated', $election, ['fields' => array_keys($data), 'settings' => $data['settings'] ?? null]);

        return new ElectionResource($election);
    }

    public function status(ElectionStatusRequest $request, ElectionService $service): JsonResponse
    {
        $election = Election::current() ?? abort(404, 'Belum ada pemilihan.');

        if ($request->input('status') === Election::OPEN && $election->status === Election::CLOSED && ! $request->user()->isAdmin()) {
            abort(403, 'Hanya admin yang dapat membuka kembali pemilihan.');
        }

        $info = $service->transition($election, $request->input('status'));

        return response()->json(['data' => new ElectionResource($election->refresh()), 'info' => $info]);
    }

    public function verify(LedgerService $ledger): JsonResponse
    {
        $election = Election::current() ?? abort(404, 'Belum ada pemilihan.');

        return response()->json($ledger->verify($election));
    }

    /** Laporan akhir (JSON untuk dicetak dari panel). */
    public function report(ResultService $results, LedgerService $ledger): JsonResponse
    {
        $election = Election::current() ?? abort(404, 'Belum ada pemilihan.');

        return response()->json([
            'results' => $results->build($election),
            'verification' => $ledger->verify($election),
            'generated_at' => now()->toIso8601String(),
        ]);
    }
}
