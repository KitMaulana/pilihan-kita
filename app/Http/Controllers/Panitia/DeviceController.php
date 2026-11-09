<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Requests\DeviceStoreRequest;
use App\Http\Resources\KioskDeviceResource;
use App\Models\BallotTicket;
use App\Models\KioskDevice;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class DeviceController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return KioskDeviceResource::collection(KioskDevice::orderByDesc('is_active')->orderBy('name')->get());
    }

    /** Token polos hanya ditampilkan SEKALI di respons ini. */
    public function store(DeviceStoreRequest $request, AuditService $audit): JsonResponse
    {
        [$device, $plain] = KioskDevice::register($request->input('name'), $request->user()->id);
        $audit->log('device.registered', $device, ['name' => $device->name]);

        return response()->json([
            'device' => new KioskDeviceResource($device),
            'token' => $plain,
            'setup_url' => url('/kiosk/pasang').'#token='.$plain,
            'message' => 'Simpan token ini sekarang. Token tidak akan ditampilkan lagi.',
        ], 201);
    }

    public function revoke(KioskDevice $device, AuditService $audit): KioskDeviceResource
    {
        $device->forceFill(['is_active' => false, 'revoked_at' => now()])->save();
        BallotTicket::where('device_id', $device->id)->delete();
        $audit->log('device.revoked', $device, ['name' => $device->name]);

        return new KioskDeviceResource($device);
    }
}
