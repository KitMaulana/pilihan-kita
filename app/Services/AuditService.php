<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;

/** Mencatat aksi panitia/admin. Jangan pernah memasukkan vektor wajah ke `details`. */
class AuditService
{
    public function log(string $action, ?Model $subject = null, array $details = []): ActivityLog
    {
        $request = request();

        return ActivityLog::create([
            'user_id' => $request?->user()?->id,
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject?->getKey(),
            'details' => $details ?: null,
            'ip' => $request?->ip(),
        ]);
    }
}
