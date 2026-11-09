<?php

namespace App\Services;

use App\Models\Election;
use App\Models\FaceTemplate;
use App\Models\Voter;
use Illuminate\Support\Facades\DB;

/** Menyimpan template wajah (vektor saja — foto tidak pernah sampai ke server). */
class FaceTemplateService
{
    public function __construct(private FaceMatchService $matcher, private AuditService $audit) {}

    /**
     * @param  float[]  $embedding  sudah lolos FaceMatchService::sanitize()
     * @return array{template: FaceTemplate, duplicate: ?array}
     */
    public function store(Voter $voter, array $embedding, string $modelVersion, ?float $quality): array
    {
        $election = Election::current();
        $dupThreshold = (float) ($election?->setting('duplicate_threshold') ?? Election::DEFAULT_SETTINGS['duplicate_threshold']);

        // Deteksi wajah ganda: bandingkan dengan semua template LAIN.
        $match = $this->matcher->match($embedding, $voter->id, (bool) $voter->is_simulation);
        $duplicate = null;
        if ($match['voter_id'] !== null && $match['s1'] >= $dupThreshold) {
            $other = Voter::find($match['voter_id']);
            $duplicate = [
                'voter_id' => $other?->id,
                'name' => $other?->name,
                'class_name' => $other?->displayClass(),
                'score' => round($match['s1'], 4),
            ];
        }

        $template = DB::transaction(function () use ($voter, $embedding, $modelVersion, $quality, $duplicate) {
            return FaceTemplate::updateOrCreate(
                ['voter_id' => $voter->id],
                [
                    'embedding' => FaceTemplate::pack($embedding),
                    'model_version' => $modelVersion,
                    'quality_score' => $quality,
                    'duplicate_of_voter_id' => $duplicate['voter_id'] ?? null,
                    'duplicate_score' => $duplicate['score'] ?? null,
                ]
            );
        });

        $this->matcher->flush();
        $this->audit->log('face_template.stored', $voter, [
            'model_version' => $modelVersion,
            'quality' => $quality,
            'duplicate_of' => $duplicate['voter_id'] ?? null,
        ]);

        return ['template' => $template, 'duplicate' => $duplicate];
    }

    public function delete(Voter $voter): bool
    {
        $deleted = FaceTemplate::where('voter_id', $voter->id)->delete() > 0;
        if ($deleted) {
            $this->matcher->flush();
            $this->audit->log('face_template.deleted', $voter);
        }

        return $deleted;
    }

    /** Penghapusan massal pasca-pemilihan (kebijakan retensi §8). */
    public function purgeAll(): int
    {
        $count = FaceTemplate::count();
        FaceTemplate::query()->delete();
        $this->matcher->flush();
        $this->audit->log('face_template.purged_all', null, ['count' => $count]);

        return $count;
    }
}
