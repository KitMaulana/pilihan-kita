<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Requests\CandidateRequest;
use App\Http\Resources\CandidateResource;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Vote;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class CandidateController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $election = Election::current();

        return CandidateResource::collection($election ? $election->candidates()->get() : collect());
    }

    public function store(CandidateRequest $request, AuditService $audit): CandidateResource
    {
        $election = $this->editableElection();
        $data = $request->safe()->except(['photo', 'remove_photo']);
        $this->ensureUniqueNumber($election, (int) $data['number']);

        $candidate = new Candidate($data + ['election_id' => $election->id]);
        if ($request->hasFile('photo')) {
            $candidate->photo_path = $request->file('photo')->store('candidates', 'public');
        }
        $candidate->save();
        $audit->log('candidate.created', $candidate, ['number' => $candidate->number, 'name' => $candidate->name]);

        return new CandidateResource($candidate);
    }

    public function update(CandidateRequest $request, Candidate $candidate, AuditService $audit): CandidateResource
    {
        $election = $this->editableElection();
        abort_unless($candidate->election_id === $election->id, 404);

        $data = $request->safe()->except(['photo', 'remove_photo']);
        if (isset($data['number']) && (int) $data['number'] !== $candidate->number) {
            $this->ensureUniqueNumber($election, (int) $data['number']);
        }
        $candidate->fill($data);

        if ($request->boolean('remove_photo') || $request->hasFile('photo')) {
            if ($candidate->photo_path) {
                Storage::disk('public')->delete($candidate->photo_path);
            }
            $candidate->photo_path = $request->hasFile('photo')
                ? $request->file('photo')->store('candidates', 'public')
                : null;
        }
        $candidate->save();
        $audit->log('candidate.updated', $candidate, ['fields' => array_keys($data)]);

        return new CandidateResource($candidate);
    }

    public function destroy(Candidate $candidate, AuditService $audit): JsonResponse
    {
        $this->editableElection();
        if (Vote::where('candidate_id', $candidate->id)->exists()) {
            throw ValidationException::withMessages(['candidate' => 'Kandidat yang sudah memperoleh suara tidak dapat dihapus.']);
        }
        if ($candidate->photo_path) {
            Storage::disk('public')->delete($candidate->photo_path);
        }
        $audit->log('candidate.deleted', $candidate, ['name' => $candidate->name]);
        $candidate->delete();

        return response()->json(['message' => 'Kandidat dihapus.']);
    }

    /** §8: jangan mengubah data kandidat setelah pemilihan dibuka. */
    private function editableElection(): Election
    {
        $election = Election::current();
        if (! $election) {
            throw ValidationException::withMessages(['election' => 'Buat pemilihan terlebih dahulu di menu Jadwal.']);
        }
        if ($election->status !== Election::DRAFT) {
            throw ValidationException::withMessages(['election' => 'Data kandidat hanya bisa diubah saat pemilihan berstatus draf.']);
        }

        return $election;
    }

    private function ensureUniqueNumber(Election $election, int $number): void
    {
        if ($election->candidates()->where('number', $number)->exists()) {
            throw ValidationException::withMessages(['number' => "Nomor urut {$number} sudah dipakai."]);
        }
    }
}
