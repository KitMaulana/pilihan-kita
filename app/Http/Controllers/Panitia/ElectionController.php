<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Requests\ElectionStatusRequest;
use App\Http\Requests\ElectionUpdateRequest;
use App\Http\Resources\ElectionResource;
use App\Models\Election;
use App\Services\AuditService;
use App\Services\ElectionService;
use App\Services\FaceMatchService;
use App\Services\LedgerService;
use App\Services\ReportPdfService;
use App\Services\ResultService;
use App\Services\SessionDeletionService;
use App\Services\VoteResetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ElectionController extends Controller
{
    public function show(): JsonResponse
    {
        $election = Election::current();

        return response()->json(['data' => $election ? new ElectionResource($election) : null]);
    }

    /**
     * Daftar sesi (sekolah) yang boleh diakses akun ini, untuk pemilih sesi di panel.
     * Panitia yang dibatasi hanya melihat sesinya sendiri.
     */
    public function sessions(Request $request): JsonResponse
    {
        $only = $request->user()->restrictedElectionId();
        $current = Election::current();

        $rows = Election::query()
            ->when($only !== null, fn ($q) => $q->whereKey($only))
            ->withCount(['voters', 'votes', 'candidates', 'devices'])
            ->orderByDesc('id')->get()
            ->map(fn (Election $e) => [
                'id' => $e->id,
                'name' => $e->name,
                'school_name' => $e->school_name,
                'slug' => $e->slug,
                'label' => $e->label(),
                'status' => $e->status,
                'is_simulation' => $e->is_simulation,
                'is_voting_open' => $e->isVotingOpen(),
                'ballot_mode' => $e->ballotMode(),
                'voters_count' => $e->voters_count,
                'votes_count' => $e->votes_count,
                'candidates_count' => $e->candidates_count,
                'devices_count' => $e->devices_count,
                'can_delete' => SessionDeletionService::canDelete($e),
                'delete_phrase' => SessionDeletionService::confirmPhrase($e),
                'public_url' => '/hasil/'.$e->slug,
            ]);

        return response()->json([
            'data' => $rows,
            'current_id' => $current?->id,
            'restricted' => $only !== null,
        ]);
    }

    /** Admin: buat SESI baru (satu sekolah, satu pemilihan). Boleh berjalan bersamaan dengan sesi lain. */
    public function store(Request $request, AuditService $audit): JsonResponse
    {
        $data = $request->validate([
            'school_name' => ['required', 'string', 'max:150'],
            'name' => ['required', 'string', 'max:150'],
            'ballot_mode' => ['sometimes', 'in:pair,separate'],
        ], [
            'school_name.required' => 'Nama sekolah wajib diisi.',
            'name.required' => 'Nama pemilihan wajib diisi.',
        ]);

        $election = Election::create([
            'school_name' => trim($data['school_name']),
            'name' => trim($data['name']),
            'slug' => Election::makeSlug($data['school_name']),
            'status' => Election::DRAFT,
            'settings' => ['ballot_mode' => $data['ballot_mode'] ?? Election::MODE_PAIR] + Election::DEFAULT_SETTINGS,
        ]);
        Election::useCurrent($election);
        $audit->log('election.created', $election, ['name' => $election->name, 'school' => $election->school_name]);

        return response()->json(['data' => new ElectionResource($election)], 201);
    }

    /**
     * Admin: hapus sesi yang sedang dipilih BESERTA SELURUH datanya (permanen). Hanya untuk sesi yang
     * tidak sedang dibuka. Konfirmasi: ketik "HAPUS {NAMA SEKOLAH}".
     */
    public function destroy(Request $request, SessionDeletionService $deletion): JsonResponse
    {
        $election = Election::current() ?? abort(404, 'Belum ada sesi.');
        $request->validate(['confirm' => ['required', 'string']], ['confirm.required' => 'Ketik "'.SessionDeletionService::confirmPhrase($election).'" untuk mengonfirmasi.']);

        $result = $deletion->delete($election, (string) $request->input('confirm'));

        return response()->json([
            'deleted' => $result,
            'message' => "Sesi {$result['label']} dihapus beserta {$result['voters']} pemilih, {$result['votes']} suara, dan {$result['candidates']} kandidat.",
        ]);
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
            $this->guardBallotModeChange($election, $data['settings']['ballot_mode'] ?? null);
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

    /** Khusus admin: reset semua suara (uji coba). Konfirmasi ganda: ketik "RESET SUARA". */
    public function resetVotes(Request $request, VoteResetService $reset): JsonResponse
    {
        $request->validate(
            ['confirm' => ['required', 'in:RESET SUARA'], 'clear_attempts' => ['sometimes', 'boolean']],
            ['confirm.required' => 'Ketik "RESET SUARA" untuk mengonfirmasi.', 'confirm.in' => 'Ketik "RESET SUARA" untuk mengonfirmasi.'],
        );
        $election = Election::current() ?? abort(404, 'Belum ada pemilihan.');

        $result = $reset->resetAll($election, $request->boolean('clear_attempts'));

        return response()->json([
            'data' => new ElectionResource($election->refresh()),
            'reset' => $result,
            'message' => "{$result['votes']} suara dihapus; {$result['voters']} pemilih kembali berstatus belum memilih.",
        ]);
    }

    public function verify(LedgerService $ledger): JsonResponse
    {
        $election = Election::current() ?? abort(404, 'Belum ada pemilihan.');

        return response()->json($ledger->verify($election));
    }

    /** Laporan hasil sebagai PDF A4 siap cetak. Belum dipublikasikan → ditandai "HASIL SEMENTARA". */
    public function reportPdf(Request $request, ReportPdfService $report, AuditService $audit)
    {
        $election = Election::current() ?? abort(404, 'Belum ada pemilihan.');
        ['pdf' => $pdf, 'filename' => $filename] = $report->make($election);
        $audit->log('report.pdf', $election, ['status' => $election->status]);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => ($request->boolean('inline') ? 'inline' : 'attachment').'; filename="'.$filename.'"',
            'Content-Length' => (string) strlen($pdf),
            'Cache-Control' => 'private, no-store',
        ]);
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
    /**
     * Skema surat suara hanya boleh diganti saat DRAF (siapa pun perannya), dan hanya bila kandidat yang ada
     * cocok dengan skema baru — agar surat suara di bilik tidak pernah berisi jabatan yang salah.
     */
    private function guardBallotModeChange(Election $election, ?string $mode): void
    {
        if ($mode === null || $mode === $election->ballotMode()) {
            return;
        }
        if ($election->status !== Election::DRAFT) {
            throw ValidationException::withMessages(['settings.ballot_mode' => 'Skema pemilihan hanya bisa diubah saat pemilihan masih draf.']);
        }
        $mismatch = $election->candidates()->whereNotIn('position', Election::positionsFor($mode))->count();
        if ($mismatch > 0) {
            throw ValidationException::withMessages(['settings.ballot_mode' => "Hapus {$mismatch} kandidat yang terdaftar dengan skema lama terlebih dahulu (menu Kandidat), lalu ubah skema."]);
        }
    }
}