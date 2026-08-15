# ===========================================================================
# 简易 HTTP 服务器（PowerShell + HttpListener）
# 用法：powershell.exe -ExecutionPolicy Bypass -NoProfile -File tools\server.ps1
# 访问：http://localhost:8000/
# ===========================================================================

param([int]$Port = 8000, [string]$Root = (Get-Location).Path)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Web

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " 世界观档案库 · 本地预览服务器已启动" -ForegroundColor Cyan
Write-Host " 地址：http://localhost:$Port/" -ForegroundColor Green
Write-Host " 根目录：$Root" -ForegroundColor Cyan
Write-Host " 按 Ctrl+C 停止" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$mimeMap = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.txt'  = 'text/plain; charset=utf-8'
    '.xml'  = 'application/xml; charset=utf-8'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.map'  = 'application/json; charset=utf-8'
}

try {
    while ($listener.IsListening) {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response

        $urlPath = $req.Url.AbsolutePath
        if ($urlPath -eq '/') { $urlPath = '/index.html' }

        # URL 解码 + 拼接绝对路径
        $urlPath = [System.Web.HttpUtility]::UrlDecode($urlPath)
        $filePath = Join-Path $Root ($urlPath.TrimStart('/').Replace('/', '\'))

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = if ($mimeMap.ContainsKey($ext)) { $mimeMap[$ext] } else { 'application/octet-stream' }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $res.ContentType = $mime
            $res.ContentLength64 = $bytes.Length
            $res.AddHeader('Cache-Control', 'no-cache')
            $res.OutputStream.Write($bytes, 0, $bytes.Length)

            $status = [string]::Format('{0} {1} {2}', $req.HttpMethod, $urlPath, $bytes.Length)
            Write-Host "  [$([DateTime]::Now.ToString('HH:mm:ss'))] $status" -ForegroundColor Green
        } else {
            $res.StatusCode = 404
            $res.ContentType = 'text/plain; charset=utf-8'
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $urlPath")
            $res.OutputStream.Write($msg, 0, $msg.Length)
            Write-Host "  [$([DateTime]::Now.ToString('HH:mm:ss'))] 404 $urlPath" -ForegroundColor Red
        }

        $res.Close()
    }
} catch {
    if ($listener.IsListening) {
        Write-Host "`n服务器异常：$($_.Exception.Message)" -ForegroundColor Red
    }
} finally {
    if ($listener) { $listener.Stop() }
    Write-Host "服务器已停止" -ForegroundColor Yellow
}
