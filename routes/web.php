<?php

use Illuminate\Support\Facades\Route;

// SPA React: semua rute non-API dilayani satu view.
Route::view('/{any?}', 'app')
    ->where('any', '^(?!api|sanctum|build|models|wasm|storage|up).*$')
    ->name('spa');
