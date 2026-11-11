<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#07173d">
    <meta name="description" content="Pilihan Kita × CiptaKita.id — E-Voting OSIS One Face One Vote SMAN 1 Ciruas">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name') }} — E-Voting OSIS SMAN 1 Ciruas</title>
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" href="/ciptakita-logo.png" type="image/png">
    <link rel="apple-touch-icon" href="/ciptakita-logo.png">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/main.jsx'])
</head>
<body class="bg-[#f4f7fc] text-slate-900 antialiased selection:bg-brand-600 selection:text-white">
    <div id="root"></div>
    <noscript>Aplikasi ini membutuhkan JavaScript.</noscript>
</body>
</html>
