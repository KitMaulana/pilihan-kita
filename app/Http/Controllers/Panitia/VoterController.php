<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Requests\VoterImportPreviewRequest;
use App\Http\Requests\VoterStoreRequest;
use App\Http\Requests\VoterUpdateRequest;
use App\Http\Resources\VoterResource;
use App\Models\Election;
use App\Models\Voter;
use App\Services\AuditService;
use App\Services\FaceMatchService;
use App\Services\VoterExportService;
use App\Services\VoterImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VoterController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $voters = $this->filtered($request)
            ->with('faceTemplate')
            ->orderBy('type')->orderBy('class_name')->orderBy('name')
            ->paginate(min(200, max(10, (int) $request->query('per_page', 50))));

        return VoterResource::collection($voters);
    }

    /** Pemilih sesi (sekolah) aktif dengan filter yang sama untuk daftar dan ekspor. */
    private function filtered(Request $request, bool $ignoreType = false): \Illuminate\Database\Eloquent\Builder
    {
        $election = Election::current();

        return Voter::query()
            ->where('election_id', $election?->id ?? 0) // hanya pemilih sesi (sekolah) aktif
            ->search($request->query('q'))
            ->when(! $ignoreType && $request->query('type'), fn ($q, $t) => $q->where('type', $t))
            ->when($request->query('class_name'), fn ($q, $c) => $q->where('class_name', $c))
            ->when($request->query('face') === 'yes', fn ($q) => $q->has('faceTemplate'))
            ->when($request->query('face') === 'no', fn ($q) => $q->doesntHave('faceTemplate'))
            ->when($request->query('face') === 'duplicate', fn ($q) => $q->whereHas('faceTemplate', fn ($t) => $t->whereNotNull('duplicate_of_voter_id')))
            ->when($request->query('status') === 'voted', fn ($q) => $q->where('has_voted', true))
            ->when($request->query('status') === 'not_voted', fn ($q) => $q->where('has_voted', false))
            ->when($request->query('status') === 'locked', fn ($q) => $q->whereNotNull('locked_at'))
            ->when($request->query('status') === 'inactive', fn ($q) => $q->where('is_active', false));
    }

    /**
     * Unduh daftar pemilih (CSV). Format: student|teacher (sama dengan templat impor) atau full (laporan lengkap).
     * Mengikuti filter yang sedang dipakai (q, class_name, face, status). Hanya sekolah yang sedang dipilih.
     */
    public function export(Request $request, VoterExportService $export, AuditService $audit): StreamedResponse
    {
        $request->validate([
            'format' => ['required', 'in:'.implode(',', VoterExportService::FORMATS)],
            'delimiter' => ['sometimes', 'in:comma,semicolon'],
        ]);
        $election = $this->election();
        $delimiter = $request->query('delimiter') === 'comma' ? ',' : ';';

        // Ekspor siswa/guru tidak boleh diubah oleh filter "type" dari daftar.
        $query = $this->filtered($request, ignoreType: true);
        $result = $export->build($query, (string) $request->query('format'), (string) $election->school_name);

        $audit->log('voters.exported', $election, [
            'format' => $request->query('format'),
            'rows' => $result['count'],
            'filters' => array_filter($request->only(['q', 'class_name', 'face', 'status'])),
        ]);

        return response()->streamDownload(function () use ($export, $result, $delimiter) {
            $out = fopen('php://output', 'w');
            $export->write($out, $result['rows'], $delimiter);
            fclose($out);
        }, $result['filename'], [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'private, no-store',
        ]);
    }

    public function classes(): JsonResponse
    {
        return response()->json([
            'data' => Voter::where('type', Voter::STUDENT)->where('election_id', Election::current()?->id ?? 0)
                ->whereNotNull('class_name')->distinct()->orderBy('class_name')->pluck('class_name'),
        ]);
    }

    public function template(string $type, VoterImportService $import): Response
    {
        abort_unless(in_array($type, [Voter::STUDENT, Voter::TEACHER], true), 404);

        return response($import->template($type), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="templat-'.($type === Voter::STUDENT ? 'siswa' : 'guru').'.csv"',
        ]);
    }

    public function preview(VoterImportPreviewRequest $request, VoterImportService $import): JsonResponse
    {
        try {
            $result = $import->preview(
                (string) file_get_contents($request->file('file')->getRealPath()),
                $request->input('type'),
                $this->election(),
            );
        } catch (InvalidArgumentException $e) {
            throw ValidationException::withMessages(['file' => $e->getMessage()]);
        }

        return response()->json($result);
    }

    public function commit(Request $request, VoterImportService $import, AuditService $audit): JsonResponse
    {
        $request->validate(['token' => ['required', 'uuid']]);

        try {
            $result = $import->commit($request->input('token'), $this->election());
        } catch (InvalidArgumentException $e) {
            throw ValidationException::withMessages(['token' => $e->getMessage()]);
        }

        $audit->log('voters.imported', null, $result);

        return response()->json($result + ['message' => "Impor selesai: {$result['created']} baru, {$result['updated']} diperbarui."]);
    }

    /** Tambah satu pemilih (input manual). Ikut mode simulasi bila pemilihan aktif adalah simulasi. */
    public function store(VoterStoreRequest $request, VoterImportService $import, AuditService $audit): JsonResponse
    {
        $election = $this->election();
        $simulation = (bool) $election->is_simulation;
        $voter = $import->createOne($request->validated(), $election);
        $audit->log('voter.created', $voter, ['name' => $voter->name, 'type' => $voter->type, 'simulation' => $simulation]);

        return (new VoterResource($voter->load('faceTemplate')))
            ->additional(['message' => "Pemilih {$voter->name} ditambahkan".($simulation ? ' (simulasi).' : '.')])
            ->response()->setStatusCode(201);
    }

    public function update(VoterUpdateRequest $request, Voter $voter, AuditService $audit, FaceMatchService $matcher): VoterResource
    {
        $this->ensureInSession($voter);
        $before = $voter->only(array_keys($request->validated()));
        $voter->fill($request->validated())->save();

        if ($request->has('is_active')) {
            $matcher->flush();
        }
        $audit->log('voter.updated', $voter, ['before' => $before, 'after' => $request->validated()]);

        return new VoterResource($voter->load('faceTemplate'));
    }

    public function unlock(Voter $voter, AuditService $audit): VoterResource
    {
        $this->ensureInSession($voter);
        DB::table('voters')->where('id', $voter->id)->update(['locked_at' => null, 'failed_attempts' => 0]);
        $audit->log('voter.unlocked', $voter);

        return new VoterResource($voter->refresh()->load('faceTemplate'));
    }

    public function destroy(Voter $voter, AuditService $audit, FaceMatchService $matcher): JsonResponse
    {
        $this->ensureInSession($voter);
        if ($voter->has_voted) {
            throw ValidationException::withMessages(['voter' => 'Pemilih yang sudah memilih tidak dapat dihapus.']);
        }
        $audit->log('voter.deleted', $voter, ['name' => $voter->name, 'identifier' => $voter->identifier]);
        $voter->delete();
        $matcher->flush();

        return response()->json(['message' => 'Pemilih dihapus.']);
    }

    /** Sesi aktif panel; impor/tambah pemilih butuh sesi. */
    private function election(): Election
    {
        return Election::current() ?? throw ValidationException::withMessages(['session' => 'Buat sesi pemilihan terlebih dahulu di menu Sesi Sekolah.']);
    }

    /** Pemilih sesi lain diperlakukan seperti tidak ada (mencegah akses lintas sekolah). */
    private function ensureInSession(Voter $voter): void
    {
        abort_unless($voter->election_id !== null && $voter->election_id === Election::current()?->id, 404);
    }
}
