<?php

namespace App\Http\Controllers\Panitia;

use App\Http\Controllers\Controller;
use App\Http\Requests\UserStoreRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return UserResource::collection(User::with('election')->orderBy('role')->orderBy('name')->get());
    }

    public function store(UserStoreRequest $request, AuditService $audit): UserResource
    {
        $data = $request->validated();
        if (($data['role'] ?? null) === User::ROLE_ADMIN) {
            $data['election_id'] = null; // admin selalu mengakses semua sesi
        }
        $user = User::create($data);
        $audit->log('user.created', $user, ['email' => $user->email, 'role' => $user->role]);

        return new UserResource($user);
    }

    public function update(UserStoreRequest $request, User $user, AuditService $audit): UserResource
    {
        $data = array_filter($request->validated(), fn ($v, $k) => $k !== 'password' || $v, ARRAY_FILTER_USE_BOTH);

        if ($user->id === $request->user()->id && (($data['is_active'] ?? true) === false || ($data['role'] ?? $user->role) !== $user->role)) {
            throw ValidationException::withMessages(['role' => 'Anda tidak dapat menonaktifkan atau menurunkan peran akun sendiri.']);
        }

        if (($data['role'] ?? $user->role) === User::ROLE_ADMIN) {
            $data['election_id'] = null;
        }
        $user->fill($data)->save();
        $audit->log('user.updated', $user, ['fields' => array_keys(array_diff_key($data, ['password' => 1])), 'password_changed' => isset($data['password'])]);

        return new UserResource($user);
    }
}
