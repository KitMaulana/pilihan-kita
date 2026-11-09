<?php

namespace Database\Seeders;

use App\Models\Candidate;
use App\Models\Election;
use App\Models\Voter;
use Illuminate\Database\Seeder;

/** Data contoh untuk pengembangan lokal saja (dipanggil otomatis bila APP_ENV=local). */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (Election::exists()) {
            return;
        }

        $election = Election::create([
            'name' => 'Pemilihan Ketua OSIS SMAN 1 Ciruas 2026/2027',
            'status' => Election::DRAFT,
            'settings' => Election::DEFAULT_SETTINGS,
        ]);

        $candidates = [
            [1, 'Raka Pratama & Nadia Putri', 'XI IPA 2', 'Mewujudkan OSIS yang inklusif, kreatif, dan berprestasi.', "Program literasi digital\nKotak aspirasi daring\nLiga olahraga antarkelas"],
            [2, 'Fajar Hidayat & Salsa Aulia', 'XI IPS 1', 'OSIS sebagai rumah bersama seluruh siswa.', "Bank sampah sekolah\nMentoring adik kelas\nPentas seni tiap semester"],
            [3, 'Dimas Saputra & Intan Lestari', 'XI IPA 4', 'Sekolah yang bersih, aman, dan berkarakter.', "Gerakan kantin sehat\nPatroli anti-perundungan\nKlub sains dan robotika"],
        ];
        foreach ($candidates as [$no, $name, $class, $vision, $mission]) {
            Candidate::create(['election_id' => $election->id, 'number' => $no, 'name' => $name, 'class_name' => $class, 'vision' => $vision, 'mission' => $mission]);
        }

        $faker = fake('id_ID');
        $classes = ['X-1', 'X-2', 'XI IPA 1', 'XI IPS 1', 'XII IPA 1', 'XII IPS 2'];
        for ($i = 1; $i <= 60; $i++) {
            Voter::create([
                'type' => Voter::STUDENT,
                'identifier' => '00'.str_pad((string) (71000000 + $i), 8, '0', STR_PAD_LEFT),
                'name' => $faker->name(),
                'class_name' => $classes[$i % count($classes)],
                'birth_date' => $faker->dateTimeBetween('2007-01-01', '2010-12-31')->format('Y-m-d'),
            ]);
        }
        for ($i = 1; $i <= 6; $i++) {
            Voter::create([
                'type' => Voter::TEACHER,
                'identifier' => $i <= 4 ? '1980010120050110'.str_pad((string) $i, 2, '0', STR_PAD_LEFT) : null,
                'name' => $faker->name(),
                'birth_date' => $faker->dateTimeBetween('1965-01-01', '1995-12-31')->format('Y-m-d'),
            ]);
        }
    }
}
