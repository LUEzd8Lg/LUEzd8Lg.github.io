# ===========================================================================
# 合并 data/*.json → data/merged.js
# 用 JavaScriptSerializer 避开 PS5 ConvertFrom-Json 的长度限制
# ===========================================================================

[CmdletBinding()]
param([string]$DataDir = 'data')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web.Extensions

$js = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$js.MaxJsonLength = [int]::MaxValue
$js.RecursionLimit = 100

function Read-JsonFile {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @() }
    $raw = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
    # 去除 BOM
    if ($raw.Length -gt 0 -and $raw[0] -eq [char]0xFEFF) { $raw = $raw.Substring(1) }
    $raw = $raw.Trim()
    if ($raw.Length -eq 0) { return @() }
    $parsed = $js.DeserializeObject($raw)
    if ($parsed -is [System.Collections.Generic.List[object]]) {
        return [object[]]$parsed.ToArray()
    }
    return @($parsed)
}

function Write-JsArray {
    param([string]$Name, $Items, [System.Text.StringBuilder]$Sb)
    [void]$Sb.AppendLine("  D.$Name = " + $js.Serialize($Items) + ';')
    [void]$Sb.AppendLine('')
}

# 读取 JSON
$urban = Read-JsonFile -Path (Join-Path $DataDir 'anomalies-urban.json')
$operations = Read-JsonFile -Path (Join-Path $DataDir 'anomalies-operations.json')
$organizations = Read-JsonFile -Path (Join-Path $DataDir 'organizations.json')
$deities = Read-JsonFile -Path (Join-Path $DataDir 'deities.json')
$eras = Read-JsonFile -Path (Join-Path $DataDir 'eras.json')
$timelines = Read-JsonFile -Path (Join-Path $DataDir 'timelines.json')

# 过滤掉提示词占位条目
$urbanFiltered = @()
foreach ($e in $urban) {
    if ($e['id'] -ne 'UR-000' -and $e['code'] -notmatch '提示词') {
        $urbanFiltered += $e
    }
}

# 合并 anomalies
$anomalies = @()
$anomalies += $urbanFiltered
$anomalies += $operations

# 修复 deities id
foreach ($d in $deities) {
    if ($d['id'] -notmatch 'DEI-P\d+') {
        $d['id'] = 'DEI-P09'
    }
}

# 生成 JS
$outPath = Join-Path $DataDir 'merged.js'
$sb = New-Object System.Text.StringBuilder

[void]$sb.AppendLine('/* === 由 merge-manifest.ps1 自动生成，请勿手动编辑 === */')
[void]$sb.AppendLine('/* 重新生成：powershell -ExecutionPolicy Bypass -File tools\merge-manifest.ps1 */')
[void]$sb.AppendLine('(function() {')
[void]$sb.AppendLine('  if (!window.ARCHIVE_DATA) { window.ARCHIVE_DATA = { meta: {}, categories: [] }; }')
[void]$sb.AppendLine('  var D = window.ARCHIVE_DATA;')
[void]$sb.AppendLine('')

Write-JsArray -Name 'anomalies'     -Items $anomalies     -Sb $sb
Write-JsArray -Name 'organizations' -Items $organizations -Sb $sb
Write-JsArray -Name 'deities'       -Items $deities       -Sb $sb
Write-JsArray -Name 'eras'          -Items $eras          -Sb $sb
Write-JsArray -Name 'timelines'     -Items $timelines     -Sb $sb

[void]$sb.AppendLine('  D.meta.total = D.anomalies.length + D.organizations.length + D.deities.length + D.eras.length + D.timelines.length;')
[void]$sb.AppendLine('  D.meta.updated = new Date().toISOString().slice(0, 10);')
[void]$sb.AppendLine('})();')

[System.IO.File]::WriteAllText($outPath, $sb.ToString(), [System.Text.UTF8Encoding]::new($false))

Write-Host "已生成：$outPath" -ForegroundColor Green
Write-Host "  anomalies:     $($anomalies.Count) 条" -ForegroundColor Cyan
Write-Host "  organizations: $($organizations.Count) 条" -ForegroundColor Cyan
Write-Host "  deities:       $($deities.Count) 条" -ForegroundColor Cyan
Write-Host "  eras:          $($eras.Count) 条" -ForegroundColor Cyan
Write-Host "  timelines:     $($timelines.Count) 条" -ForegroundColor Cyan
$total = $anomalies.Count + $organizations.Count + $deities.Count + $eras.Count + $timelines.Count
Write-Host "  ─────────────────────" -ForegroundColor Cyan
Write-Host "  合计:          $total 条" -ForegroundColor Green
