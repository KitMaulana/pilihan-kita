<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Kesalahan alur kiosk dengan kode mesin + pesan ramah berbahasa Indonesia.
 * Dirender sebagai JSON: { code, message, ...extra }.
 */
class KioskException extends RuntimeException
{
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly int $status = 422,
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json(
            ['code' => $this->errorCode, 'message' => $this->getMessage()] + $this->extra,
            $this->status
        );
    }
}
