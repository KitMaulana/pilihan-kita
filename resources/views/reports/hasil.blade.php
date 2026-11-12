@php
    $statusLabel = ['draft' => 'Draf', 'open' => 'Dibuka', 'closed' => 'Ditutup', 'published' => 'Dipublikasikan'][$status] ?? $status;
    $fmt = fn ($n) => number_format((float) $n, 0, ',', '.');
    $pct = fn ($n) => rtrim(rtrim(number_format((float) $n, 2, ',', '.'), '0'), ',').'%';
    $p = $participation;
    $ok = $verification['ok'];
@endphp
<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Laporan Hasil — {{ $school }}</title>
<style>
    @page { size: A4 portrait; margin: 13mm 15mm 18mm 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 10pt; color: #0f172a; line-height: 1.38; }
    .brand { width: 100%; border-bottom: 2pt solid #0c2668; padding-bottom: 7pt; margin-bottom: 10pt; }
    .brand td { vertical-align: middle; }
    .brand img { height: 42pt; }
    .org { text-align: right; font-size: 9.5pt; color: #475569; }
    .org b { font-size: 12pt; color: #0f172a; }
    h1 { font-size: 15pt; margin: 0 0 2pt; color: #0c2668; }
    .sub { margin: 0 0 2pt; color: #334155; font-size: 10.5pt; }
    .meta { margin: 0 0 6pt; font-size: 8.5pt; color: #64748b; }
    .badge { display: inline-block; padding: 1pt 7pt; border-radius: 9pt; font-size: 8.5pt; font-weight: bold; background: #e2e8f0; color: #334155; }
    .badge.final { background: #dcfce7; color: #166534; }
    .badge.temp { background: #fef3c7; color: #92400e; }
    h2 { font-size: 11pt; margin: 11pt 0 4pt; color: #0c2668; }
    table.data { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
    table.data th, table.data td { border: 0.6pt solid #cbd5e1; padding: 3.2pt 6pt; }
    table.data th { background: #eef2f7; font-size: 9pt; text-align: left; }
    table.data td.num, table.data th.num { text-align: right; }
    table.data td.no { width: 34pt; text-align: center; font-weight: bold; }
    table.data tr.top td { background: #f0fdf4; font-weight: bold; }
    table.data tr.total td { background: #eef2ff; font-weight: bold; border-top: 1.4pt solid #0c2668; }
    .win { font-size: 8pt; color: #166534; font-weight: bold; }
    .kv { width: 100%; border-collapse: collapse; }
    .kv td { padding: 2pt 0; vertical-align: top; }
    .kv td.k { width: 150pt; color: #475569; }
    .hash { font-family: 'DejaVu Sans Mono', monospace; font-size: 8pt; word-break: break-all; color: #334155; background: #f8fafc; border: 0.6pt solid #e2e8f0; padding: 5pt 7pt; }
    .ok { color: #166534; font-weight: bold; } .bad { color: #b91c1c; font-weight: bold; }
    .note { margin: 5pt 0 0; font-size: 8pt; color: #64748b; }
    table.sign { width: 100%; margin-top: 18pt; page-break-inside: avoid; }
    table.sign td { width: 50%; text-align: center; vertical-align: top; padding: 0 12pt; }
    .sign .space { height: 44pt; }
    .sign .line { border-top: 0.8pt solid #0f172a; padding-top: 3pt; font-size: 9pt; color: #475569; }
    .footer { position: fixed; left: 0; right: 0; bottom: -12mm; font-size: 8pt; color: #94a3b8; border-top: 0.5pt solid #e2e8f0; padding-top: 4pt; }
    .footer table { width: 100%; } .footer td.r { text-align: right; }
    .pagenum:after { content: counter(page); }
    /* Skema terpisah memuat dua tabel perolehan: dipadatkan agar tetap muat satu lembar A4. */
    body.compact { line-height: 1.28; }
    body.compact .brand img { height: 36pt; }
    body.compact .brand { margin-bottom: 7pt; padding-bottom: 5pt; }
    body.compact h2 { margin: 8pt 0 3pt; }
    body.compact table.data th, body.compact table.data td { padding: 2.3pt 6pt; }
    body.compact table.sign { margin-top: 12pt; }
    body.compact .sign .space { height: 32pt; }
    body.compact .note { margin-top: 3pt; }
</style>
</head>
<body class="{{ $multi ? 'compact' : '' }}">

<div class="footer">
    <table><tr>
        <td>Pilihan Kita · CiptaKita.id — {{ $school }}</td>
        <td class="r">Halaman <span class="pagenum"></span></td>
    </tr></table>
</div>

<table class="brand"><tr>
    <td>@if ($logo)<img src="{{ $logo }}" alt="CiptaKita.id">@else<b style="font-size:16pt;color:#0c2668">CiptaKita.id</b>@endif</td>
    <td class="org"><b>Pilihan Kita</b><br>E-Voting OSIS<br>{{ $school }}</td>
</tr></table>

<h1>{{ $isFinal ? 'Laporan Hasil Akhir Pemilihan' : 'Laporan Hasil Pemilihan' }}</h1>
<p class="sub"><b>{{ $school }}</b> — {{ $electionName }}</p>
<p class="meta">
    Status: <span class="badge {{ $isFinal ? 'final' : 'temp' }}">{{ $statusLabel }}</span>
    @unless ($isFinal) &nbsp; <b>HASIL SEMENTARA — bukan rekap resmi</b>@endunless
    <br>Dibuat: {{ $generatedAt->translatedFormat('d F Y, H.i') }} WIB
</p>

<h2>Perolehan Suara</h2>
@foreach ($positions as $group)
    @php
        $total = collect($group['candidates'])->sum('votes');
        $max = collect($group['candidates'])->max('votes');
    @endphp
    @if ($multi)<p style="margin:10pt 0 4pt;font-weight:bold;color:#0c2668">{{ $group['label'] }}</p>@endif
    <table class="data">
        <tr>
            <th class="no" style="text-align:center">No</th>
            <th>{{ $multi ? 'Calon' : 'Kandidat' }}</th>
            <th class="num" style="width:62pt">Suara</th>
            <th class="num" style="width:62pt">%</th>
        </tr>
        @foreach ($group['candidates'] as $c)
            <tr class="{{ $isFinal && $max > 0 && $c['votes'] === $max ? 'top' : '' }}">
                <td class="no">{{ $c['number'] }}</td>
                <td>{{ $c['name'] }}@if ($c['class_name']) <span style="color:#64748b;font-size:9pt">({{ $c['class_name'] }})</span>@endif
                    @if ($isFinal && $max > 0 && $c['votes'] === $max)<br><span class="win">✓ Perolehan suara terbanyak</span>@endif</td>
                <td class="num">{{ $fmt($c['votes']) }}</td>
                <td class="num">{{ $pct($c['percent']) }}</td>
            </tr>
        @endforeach
        <tr class="total">
            <td colspan="2" class="num">Total suara{{ $multi ? ' '.$group['label'] : '' }}</td>
            <td class="num">{{ $fmt($total) }}</td>
            <td class="num">{{ $total > 0 ? '100%' : '0%' }}</td>
        </tr>
    </table>
@endforeach
<p class="note">
    Jumlah surat suara masuk: <b>{{ $fmt($votesCounted) }}</b>@if ($multi) (setiap surat suara berisi pilihan ketua dan wakil)@endif.
    @if ($boothWaiting > 0 && ! $isFinal) {{ $fmt($boothWaiting) }} pemilih sudah check-in dan belum memilih.@endif
</p>

<h2>Partisipasi Pemilih</h2>
<table class="data">
    <tr><th>Kelompok</th><th class="num" style="width:84pt">Sudah check-in</th><th class="num" style="width:70pt">Terdaftar</th><th class="num" style="width:70pt">Partisipasi</th></tr>
    @foreach ([['Siswa', $p['students']], ['Guru & staf', $p['teachers']]] as [$label, $row])
        <tr>
            <td>{{ $label }}</td>
            <td class="num">{{ $fmt($row['voted']) }}</td>
            <td class="num">{{ $fmt($row['total']) }}</td>
            <td class="num">{{ $row['total'] > 0 ? $pct($row['voted'] * 100 / $row['total']) : '0%' }}</td>
        </tr>
    @endforeach
    <tr class="total">
        <td>Total</td>
        <td class="num">{{ $fmt($p['all']['voted']) }}</td>
        <td class="num">{{ $fmt($p['all']['total']) }}</td>
        <td class="num">{{ $p['all']['total'] > 0 ? $pct($p['all']['voted'] * 100 / $p['all']['total']) : '0%' }}</td>
    </tr>
</table>

<h2>Integritas Suara (Ledger)</h2>
<table class="kv">
    <tr><td class="k">Verifikasi rantai hash</td><td><span class="{{ $ok ? 'ok' : 'bad' }}">{{ $ok ? 'VALID' : 'TIDAK VALID' }}</span> — {{ $fmt($verification['sealed']) }} suara tersegel{{ $verification['pending'] > 0 ? ', '.$fmt($verification['pending']).' menunggu segel' : '' }}</td></tr>
    @unless ($ok)
        <tr><td class="k">Temuan</td><td class="bad">{{ implode(' · ', array_slice($verification['errors'], 0, 3)) }}</td></tr>
    @endunless
    <tr><td class="k">Hash terakhir (SHA-256)</td><td>@if ($isFinal && $verification['head'])<div class="hash">{{ $verification['head'] }}</div>@else<span style="color:#64748b">Dipublikasikan setelah hasil ditetapkan.</span>@endif</td></tr>
</table>
<p class="note">Suara bersifat rahasia: laporan ini hanya memuat angka agregat dan tidak memuat identitas pemilih. Kode resi pemilih dapat dicek di halaman publik "Cek Resi".</p>

<table class="sign">
    <tr>
        <td><div>Ketua Panitia</div><div class="space"></div><div class="line">(&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;)</div></td>
        <td><div>Kepala Sekolah</div><div class="space"></div><div class="line">(&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;&hellip;)</div></td>
    </tr>
</table>

</body>
</html>
