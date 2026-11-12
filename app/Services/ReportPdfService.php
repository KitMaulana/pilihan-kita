<?php

namespace App\Services;

use App\Models\Election;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Str;

/**
 * Laporan hasil pemilihan sebagai PDF A4 (potret) siap cetak.
 *
 * Isi sama dengan tampilan hasil: perolehan per jabatan beserta total, partisipasi, verifikasi ledger,
 * hash terakhir, dan blok tanda tangan. Tidak memuat identitas pemilih sama sekali.
 */
class ReportPdfService
{
    public function __construct(private ResultService $results, private LedgerService $ledger) {}

    /** @return array{pdf: string, filename: string} */
    public function make(Election $election): array
    {
        $html = $this->html($election);

        $options = new Options;
        $options->set('isRemoteEnabled', false); // logo ditanam sebagai data URI; tidak ada permintaan jaringan
        $options->set('isPhpEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans'); // mendukung "—", "·", dan aksara Latin lengkap
        $options->set('chroot', base_path());
        $options->set('tempDir', storage_path('app'));

        $dompdf = new Dompdf($options);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->render();

        return [
            'pdf' => $dompdf->output(),
            'filename' => 'Laporan-Hasil-'.Str::slug($election->school_name ?: 'sekolah').'-'.now('Asia/Jakarta')->format('Ymd-Hi').'.pdf',
        ];
    }

    /** HTML laporan (juga dipakai tes untuk memeriksa isi tanpa mengurai PDF). */
    public function html(Election $election): string
    {
        $data = $this->results->build($election);
        $verification = $this->ledger->verify($election);

        return view('reports.hasil', [
            'school' => $election->school_name,
            'electionName' => $election->name,
            'status' => $election->status,
            'isFinal' => $election->status === Election::PUBLISHED,
            'multi' => count($data['positions']) > 1,
            'positions' => $data['positions'],
            'participation' => $data['participation'],
            'votesCounted' => $data['votes_counted'],
            'boothWaiting' => $data['booth_waiting'],
            'verification' => $verification,
            'generatedAt' => now('Asia/Jakarta'),
            'logo' => $this->logoDataUri(),
        ])->render();
    }

    /**
     * Logo CiptaKita dipangkas dari ruang transparan di sekelilingnya (sama seperti komponen BrandLogo di
     * aplikasi: 860×312 px mulai dari titik 92,174 pada berkas 1024×682) lalu ditanam sebagai data URI.
     */
    private function logoDataUri(): ?string
    {
        $path = public_path('ciptakita-logo.png');
        if (! is_file($path) || ! function_exists('imagecreatefrompng')) {
            return null;
        }
        $src = @imagecreatefrompng($path);
        if (! $src) {
            return null;
        }
        $crop = imagecrop($src, ['x' => 92, 'y' => 174, 'width' => 860, 'height' => 312]);
        imagedestroy($src);
        if (! $crop) {
            return null;
        }
        imagesavealpha($crop, true);
        ob_start();
        imagepng($crop);
        $png = (string) ob_get_clean();
        imagedestroy($crop);

        return 'data:image/png;base64,'.base64_encode($png);
    }
}
