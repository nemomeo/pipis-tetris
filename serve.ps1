$root = $PSScriptRoot
$listener = New-Object System.Net.HttpListener

$bound = $false
foreach ($prefix in @('http://+:8000/', 'http://localhost:8000/')) {
    try {
        $listener.Prefixes.Add($prefix)
        $bound = $true
    } catch {
        Write-Host "Failed to bind $prefix ($_)"
    }
}
if (-not $bound) { Write-Host "No usable prefix. Exit."; exit 1 }

$listener.Start()

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -eq 'Dhcp' } | Select-Object -First 1).IPAddress
if (-not $lanIp) {
    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' } | Select-Object -First 1).IPAddress
}

Write-Host ""
Write-Host "============================================"
Write-Host "  Tetris - local server started"
Write-Host "============================================"
Write-Host "  Local:  http://localhost:8000/"
if ($lanIp) { Write-Host "  Mobile: http://$lanIp`:8000/  (phone on same WiFi)" }
Write-Host "  Root:   $root"
Write-Host "  Press Ctrl+C to stop"
Write-Host "============================================"
Write-Host ""

while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $path = $req.Url.AbsolutePath
    if ($path -eq '/') { $path = '/index.html' }
    $file = Join-Path $root $path.TrimStart('/')
    if (Test-Path $file -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $ext = [System.IO.Path]::GetExtension($file)
        $mime = switch ($ext) {
            '.html' { 'text/html; charset=utf-8' }
            '.css'  { 'text/css; charset=utf-8' }
            '.js'   { 'application/javascript; charset=utf-8' }
            '.png'  { 'image/png' }
            '.jpg'  { 'image/jpeg' }
            '.svg'  { 'image/svg+xml' }
            default { 'application/octet-stream' }
        }
        $res.ContentType = $mime
        $res.ContentLength64 = $bytes.Length
        $res.AddHeader('Cache-Control', 'no-cache')
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $res.StatusCode = 404
    }
    $res.Close()
}
