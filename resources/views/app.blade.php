<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#0f3d75">
    <meta name="description" content="E-Voting OSIS One Face One Vote — SMAN 1 Ciruas">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name') }} — E-Voting OSIS SMAN 1 Ciruas</title>
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="icon" href="/icon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="/icon-192.png">
    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/main.jsx'])
</head>
<body class="bg-slate-50 text-slate-900 antialiased">
    <div id="root"></div>
    <noscript>Aplikasi ini membutuhkan JavaScript.</noscript>
</body>
</html>
