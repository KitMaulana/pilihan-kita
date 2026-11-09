<?php

namespace Database\Factories;

use App\Models\Voter;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Voter> */
class VoterFactory extends Factory
{
    protected $model = Voter::class;

    public function definition(): array
    {
        return [
            'type' => Voter::STUDENT,
            'identifier' => (string) fake()->unique()->numerify('00########'),
            'name' => fake()->name(),
            'class_name' => 'XI IPA 1',
            'birth_date' => '2008-05-17',
            'is_active' => true,
            'is_simulation' => false,
        ];
    }

    public function teacher(?string $nip = null): static
    {
        return $this->state(fn () => [
            'type' => Voter::TEACHER,
            'identifier' => $nip,
            'class_name' => null,
            'birth_date' => '1980-01-01',
        ]);
    }
}
