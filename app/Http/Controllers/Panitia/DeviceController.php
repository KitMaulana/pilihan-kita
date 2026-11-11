<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Requests\DeviceStoreRequest;
use App\Http\Resources\KioskDeviceResource;
use App\Models\BallotTicket;
use App\Models\Election;
use App\Models\KioskDevice;
use Illuminate\Validation\ValidationException;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DeviceController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        // Hanya perangkat milik sesi (sekolah) yang sedang dipilih.
        return KioskDeviceResource::collection(
            KioskDevice::where('election_id', Election::current()?->id ?? 0)->orderByDesc('is_active')->orderBy('name')->get()
        );
    }

    /** Token polos hanya ditampilkan SEKALI di respons ini. */
    public function store(DeviceStoreRequest $request, AuditService $audit): JsonResponse
    {
        $role = $request->input('role', KioskDevice::CHECKIN);
        $election = Election::current() ?? throw ValidationException::withMessages(['name' => 'Buat sesi pemilihan terlebih dahulu.']);
        [$device, $plain] = KioskDevice::register($request->input('name'), $request->user()->id, $role, $election->id);
        $audit->log('device.registered', $device, ['name' => $device->name, 'role' => $role]);

        return response()->json([
            'device' => new KioskDeviceResource($device),
            'token' => $plain,
            'setup_url' => url('/kiosk/pasang').'#token='.$plain,
            'message' => 'Simpan token ini sekarang. Token tidak akan ditampilkan lagi.',
        ], 201);
    }

    public function revoke(KioskDevice $device, AuditService $audit): KioskDeviceResource
    {
        abort_unless($device->election_id === Election::current()?->id, 404);
        $device->forceFill(['is_active' => false, 'revoked_at' => now()])->save();
        BallotTicket::where('device_id', $device->id)->delete();
        $audit->log('device.revoked', $device, ['name' => $device->name]);

        return new KioskDeviceResource($device);
    }
}
