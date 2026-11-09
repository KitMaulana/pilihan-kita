<?php

return [
    // Content-Security-Policy di produksi. Matikan (false) hanya untuk diagnosis.
    'csp' => env('SECURITY_CSP', true),

    // Versi model wajah yang diharapkan dari browser (ditolak bila berbeda).
    'face_model_version' => env('FACE_MODEL_VERSION', 'buffalo_s/w600k_mbf'),

    // Batas laju per tablet (permintaan per menit).
    'kiosk_rate' => [
        'identify' => (int) env('KIOSK_RATE_IDENTIFY', 30),
        'fallback' => (int) env('KIOSK_RATE_FALLBACK', 10),
        'vote' => (int) env('KIOSK_RATE_VOTE', 20),
        'general' => (int) env('KIOSK_RATE_GENERAL', 120),
    ],
];
