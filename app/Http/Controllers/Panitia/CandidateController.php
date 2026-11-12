<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Requests\CandidateRequest;
use App\Http\Resources\CandidateResource;
use App\Models\Candidate;
use App\Models\Election;
use App\Models\Vote;
use App\Services\AuditService;
use App\Services\CandidatePhotoService;
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

    public function store(CandidateRequest $request, AuditService $audit, CandidatePhotoService $photos): CandidateResource
    {
        $election = $this->editableElection();
        $data = $request->safe()->except(['photo', 'remove_photo']);
        $data['position'] = $this->resolvePosition($election, $data['position'] ?? null);
        $this->ensureUniqueNumber($election, (int) $data['number'], $data['position']);

        $candidate = new Candidate($data + ['election_id' => $election->id]);
        if ($request->hasFile('photo')) {
            $candidate->photo_path = $photos->store($request->file('photo'));
        }
        $candidate->save();
        $audit->log('candidate.created', $candidate, ['number' => $candidate->number, 'name' => $candidate->name]);

        return new CandidateResource($candidate);
    }

    public function update(CandidateRequest $request, Candidate $candidate, AuditService $audit, CandidatePhotoService $photos): CandidateResource
    {
        $election = $this->editableElection();
        abort_unless($candidate->election_id === $election->id, 404);

        $data = $request->safe()->except(['photo', 'remove_photo']);
        $position = $this->resolvePosition($election, $data['position'] ?? $candidate->position);
        $data['position'] = $position;
        $number = (int) ($data['number'] ?? $candidate->number);
        if ($number !== $candidate->number || $position !== $candidate->position) {
            $this->ensureUniqueNumber($election, $number, $position, $candidate->id);
        }
        $candidate->fill($data);

        if ($request->boolean('remove_photo') || $request->hasFile('photo')) {
            $photos->delete($candidate->photo_path);
            $candidate->photo_path = $request->hasFile('photo') ? $photos->store($request->file('photo')) : null;
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

    /** Nomor urut unik per jabatan (skema terpisah: ketua No. 1 dan wakil No. 1 boleh ada bersamaan). */
    private function ensureUniqueNumber(Election $election, int $number, string $position, ?int $exceptId = null): void
    {
        $taken = $election->candidates()->where('position', $position)->where('number', $number)
            ->when($exceptId, fn ($q) => $q->whereKeyNot($exceptId))->exists();
        if ($taken) {
            $label = $position === 'pair' ? '' : ' untuk '.Election::POSITION_LABELS[$position];
            throw ValidationException::withMessages(['number' => "Nomor urut {$number}{$label} sudah dipakai."]);
        }
    }

    /** Jabatan harus sesuai skema sesi: berpasangan → pair; terpisah → ketua / wakil (wajib dipilih). */
    private function resolvePosition(Election $election, ?string $requested): string
    {
        if ($election->ballotMode() === Election::MODE_PAIR) {
            if ($requested !== null && $requested !== 'pair') {
                throw ValidationException::withMessages(['position' => 'Sesi ini memakai skema berpasangan (ketua & wakil satu pasangan). Ubah skema di Jadwal & Status bila ingin dipilih terpisah.']);
            }

            return 'pair';
        }
        if (! in_array($requested, ['ketua', 'wakil'], true)) {
            throw ValidationException::withMessages(['position' => 'Pilih jabatan kandidat: Ketua atau Wakil.']);
        }

        return $requested;
    }
}
