<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Requests\VoterImportPreviewRequest;
use App\Http\Requests\VoterUpdateRequest;
use App\Http\Resources\VoterResource;
use App\Models\Election;
use App\Models\Voter;
use App\Services\AuditService;
use App\Services\FaceMatchService;
use App\Services\VoterImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

class VoterController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $sim = (bool) Election::current()?->is_simulation;

        $voters = Voter::query()
            ->with('faceTemplate')
            ->where('is_simulation', $request->boolean('simulation', $sim))
            ->search($request->query('q'))
            ->when($request->query('type'), fn ($q, $t) => $q->where('type', $t))
            ->when($request->query('class_name'), fn ($q, $c) => $q->where('class_name', $c))
            ->when($request->query('face') === 'yes', fn ($q) => $q->has('faceTemplate'))
            ->when($request->query('face') === 'no', fn ($q) => $q->doesntHave('faceTemplate'))
            ->when($request->query('face') === 'duplicate', fn ($q) => $q->whereHas('faceTemplate', fn ($t) => $t->whereNotNull('duplicate_of_voter_id')))
            ->when($request->query('status') === 'voted', fn ($q) => $q->where('has_voted', true))
            ->when($request->query('status') === 'not_voted', fn ($q) => $q->where('has_voted', false))
            ->when($request->query('status') === 'locked', fn ($q) => $q->whereNotNull('locked_at'))
            ->when($request->query('status') === 'inactive', fn ($q) => $q->where('is_active', false))
            ->orderBy('type')->orderBy('class_name')->orderBy('name')
            ->paginate(min(200, max(10, (int) $request->query('per_page', 50))));

        return VoterResource::collection($voters);
    }

    public function classes(): JsonResponse
    {
        return response()->json([
            'data' => Voter::where('type', Voter::STUDENT)->where('is_simulation', false)
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
            $result = $import->commit($request->input('token'));
        } catch (InvalidArgumentException $e) {
            throw ValidationException::withMessages(['token' => $e->getMessage()]);
        }

        $audit->log('voters.imported', null, $result);

        return response()->json($result + ['message' => "Impor selesai: {$result['created']} baru, {$result['updated']} diperbarui."]);
    }

    public function update(VoterUpdateRequest $request, Voter $voter, AuditService $audit, FaceMatchService $matcher): VoterResource
    {
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
        DB::table('voters')->where('id', $voter->id)->update(['locked_at' => null, 'failed_attempts' => 0]);
        $audit->log('voter.unlocked', $voter);

        return new VoterResource($voter->refresh()->load('faceTemplate'));
    }

    public function destroy(Voter $voter, AuditService $audit, FaceMatchService $matcher): JsonResponse
    {
        if ($voter->has_voted) {
            throw ValidationException::withMessages(['voter' => 'Pemilih yang sudah memilih tidak dapat dihapus.']);
        }
        $audit->log('voter.deleted', $voter, ['name' => $voter->name, 'identifier' => $voter->identifier]);
        $voter->delete();
        $matcher->flush();

        return response()->json(['message' => 'Pemilih dihapus.']);
    }
}
