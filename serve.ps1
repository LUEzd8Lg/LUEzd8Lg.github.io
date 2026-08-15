# 世界观察档案库 · 静态文件服务器（纯 PowerShell，无需 node/python）
# 用法：右键 → 使用 PowerShell 运行，或在终端执行：powershell -ExecutionPolicy Bypass -File serve.ps1
# 然后浏览器打开 http://localhost:8080

$port = 8080
$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  世界观察档案库 · 本地服务器已启动" -ForegroundColor Green
Write-Host "  地址: http://localhost:$port" -ForegroundColor Yellow
Write-Host "  目录: $root" -ForegroundColor Gray
Write-Host "  按 Ctrl+C 停止" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$mimeMap = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.webp' = 'image/webp'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.ttf'  = 'font/ttf'
  '.mp4'  = 'video/mp4'
  '.webm' = 'video/webm'
  '.mp3'  = 'audio/mpeg'
  '.pdf'  = 'application/pdf'
  '.txt'  = 'text/plain; charset=utf-8'
  '.md'   = 'text/plain; charset=utf-8'
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
  } catch {
    break
  }

  $req = $ctx.Request
  $res = $ctx.Response

  $urlPath = [Uri]::UnescapeDataString($req.Url.AbsolutePath)
  if ($urlPath -eq '/' -or $urlPath -eq '') { $urlPath = '/index.html' }

  $filePath = Join-Path $root $urlPath.TrimStart('/').Replace('/', '\')

  if (Test-Path $filePath -PathType Leaf) {
    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
    $mime = $mimeMap[$ext]
    if (-not $mime) { $mime = 'application/octet-stream' }

    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $res.ContentType = $mime
    $res.ContentLength64 = $bytes.Length
    $res.StatusCode = 200
    $res.Headers.Add('Cache-Control', 'no-cache, no-store, must-revalidate')
    $res.OutputStream.Write($bytes, 0, $bytes.Length)

    Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] 200 $urlPath" -ForegroundColor Green
  } else {
    $res.StatusCode = 404
    $res.ContentType = 'text/plain; charset=utf-8'
    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
    $res.ContentLength64 = $msg.Length
    $res.OutputStream.Write($msg, 0, $msg.Length)

    Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] 404 $urlPath" -ForegroundColor Red
  }

  $res.Close()
}

$listener.Stop()
