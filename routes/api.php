<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Kiosk\KioskController;
use App\Http\Controllers\Panitia\CandidateController;
use App\Http\Controllers\Panitia\DashboardController;
use App\Http\Controllers\Panitia\DeviceController;
use App\Http\Controllers\Panitia\ElectionController;
use App\Http\Controllers\Panitia\FaceTemplateController;
use App\Http\Controllers\Panitia\LogController;
use App\Http\Controllers\Panitia\SimulationController;
use App\Http\Controllers\Panitia\UserController;
use App\Http\Controllers\Panitia\VoterController;
use App\Http\Controllers\PublicController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // ── Autentikasi panitia/admin (cookie sesi Sanctum) ─────────────────────
    Route::prefix('auth')->group(function () {
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');
        Route::get('me', [AuthController::class, 'me']); // tamu → {user: null} (bukan 401)
    });

    // ── Publik ───────────────────────────────────────────────────────────────
    Route::prefix('public')->group(function () {
        Route::get('results', [PublicController::class, 'results'])->middleware('throttle:public');
        Route::post('receipt', [PublicController::class, 'receipt'])->middleware('throttle:receipt');
    });

    // ── Kiosk (tablet): device token + jam voting + batas laju ───────────────
    Route::prefix('kiosk')->middleware(['kiosk.device', 'throttle:kiosk-general'])->group(function () {
        Route::get('status', [KioskController::class, 'status']);

        Route::middleware('voting.open')->group(function () {
            Route::get('candidates', [KioskController::class, 'candidates']);
            Route::post('identify', [KioskController::class, 'identify'])->middleware('throttle:kiosk-identify');
            Route::post('fallback', [KioskController::class, 'fallback'])->middleware('throttle:kiosk-fallback');
            Route::post('confirm', [KioskController::class, 'confirm'])->middleware('throttle:kiosk-vote');
            Route::post('vote', [KioskController::class, 'vote'])->middleware('throttle:kiosk-vote');
        });
    });

    // ── Panel panitia ────────────────────────────────────────────────────────
    Route::prefix('panitia')->middleware(['auth:sanctum', 'role:admin,panitia', 'throttle:panitia'])->group(function () {
        Route::get('dashboard', DashboardController::class);

        Route::get('voters', [VoterController::class, 'index']);
        Route::get('voters/classes', [VoterController::class, 'classes']);
        Route::get('voters/template/{type}', [VoterController::class, 'template']);
        Route::post('voters/import/preview', [VoterController::class, 'preview']);
        Route::post('voters/import/commit', [VoterController::class, 'commit']);
        Route::patch('voters/{voter}', [VoterController::class, 'update']);
        Route::post('voters/{voter}/unlock', [VoterController::class, 'unlock']);

        Route::get('face-templates/status', [FaceTemplateController::class, 'status']);
        Route::post('face-templates/lookup', [FaceTemplateController::class, 'lookup']);
        Route::post('face-templates', [FaceTemplateController::class, 'store']);

        Route::get('candidates', [CandidateController::class, 'index']);
        Route::post('candidates', [CandidateController::class, 'store']);
        Route::post('candidates/{candidate}', [CandidateController::class, 'update']); // multipart (foto)
        Route::delete('candidates/{candidate}', [CandidateController::class, 'destroy']);

        Route::get('devices', [DeviceController::class, 'index']);
        Route::post('devices', [DeviceController::class, 'store']);
        Route::post('devices/{device}/revoke', [DeviceController::class, 'revoke']);

        Route::get('election', [ElectionController::class, 'show']);
        Route::post('election', [ElectionController::class, 'store']);
        Route::put('election', [ElectionController::class, 'update']);
        Route::post('election/status', [ElectionController::class, 'status']);
        Route::get('election/verify', [ElectionController::class, 'verify']);
        Route::get('election/report', [ElectionController::class, 'report']);

        Route::get('logs/attempts', [LogController::class, 'attempts']);
        Route::get('logs/attempts/export', [LogController::class, 'exportAttempts']);
        Route::get('logs/activity', [LogController::class, 'activity']);

        // Khusus admin
        Route::middleware('role:admin')->group(function () {
            Route::delete('voters/{voter}', [VoterController::class, 'destroy']);
            Route::delete('face-templates/{voter}', [FaceTemplateController::class, 'destroy']);
            Route::post('face-templates/purge', [FaceTemplateController::class, 'purge']);

            Route::get('users', [UserController::class, 'index']);
            Route::post('users', [UserController::class, 'store']);
            Route::patch('users/{user}', [UserController::class, 'update']);

            Route::post('simulation', [SimulationController::class, 'store']);
            Route::post('simulation/purge', [SimulationController::class, 'destroy']);
        });
    });
});
