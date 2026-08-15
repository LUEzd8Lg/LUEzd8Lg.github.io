# ===========================================================================
# docx → JSON 提取脚本
# 依赖：.NET Framework 4.5+（System.IO.Compression + System.Xml）
# 不依赖 Word / python-docx
#
# 用法：
#   powershell.exe -ExecutionPolicy Bypass -File tools\extract-docx.ps1
# ===========================================================================

[CmdletBinding()]
param(
    [string]$Source = "C:\Users\12738\Desktop\世界观",
    [string]$OutDir = "data"
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# ---------- 工具函数：从单个 docx 提取文本 ----------
function Extract-DocxText {
    param([string]$Path)

    $result = [pscustomobject]@{
        Path = $Path
        Name = [System.IO.Path]::GetFileNameWithoutExtension($Path)
        Paragraphs = @()   # 每段：{ style, text }
        Text = ""          # 全文拼接
        Headings = @()     # 仅标题
        Error = $null
    }

    try {
        $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
        try {
            $entry = $zip.Entries | Where-Object { $_.FullName -eq 'word/document.xml' } | Select-Object -First 1
            if (-not $entry) {
                $result.Error = "no word/document.xml"
                return $result
            }

            $stream = $entry.Open()
            try {
                $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
                $xmlContent = $reader.ReadToEnd()
            } finally {
                $stream.Dispose()
            }

            # 解析 XML
            $doc = New-Object System.Xml.XmlDocument
            $doc.PreserveWhitespace = $true
            $doc.LoadXml($xmlContent)

            $nsmgr = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
            $nsmgr.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')

            $paragraphs = $doc.SelectNodes('//w:p', $nsmgr)
            $allText = New-Object System.Text.StringBuilder
            $paraList = @()
            $headingList = @()

            foreach ($p in $paragraphs) {
                # 检测段落样式（标题/正文）
                $styleNode = $p.SelectSingleNode('.//w:pStyle/@w:val', $nsmgr)
                $style = if ($styleNode) { $styleNode.Value } else { '' }

                # 拼接段内所有 <w:t> 文本
                $texts = $p.SelectNodes('.//w:t', $nsmgr)
                $sb = New-Object System.Text.StringBuilder
                foreach ($t in $texts) { [void]$sb.Append($t.InnerText) }
                $paraText = $sb.ToString()

                # 检测列表项标记 <w:numPr>
                $numNode = $p.SelectSingleNode('.//w:numPr', $nsmgr)
                $isListItem = $null -ne $numNode

                if ($paraText.Trim().Length -gt 0) {
                    $paraList += [pscustomobject]@{
                        style = $style
                        text = $paraText
                        isList = $isListItem
                    }
                    [void]$allText.AppendLine($paraText)

                    if ($style -match 'Heading|heading|Title|title' -or $style -match '^[1-9]$') {
                        $headingList += [pscustomobject]@{ style = $style; text = $paraText }
                    }
                }
            }

            $result.Paragraphs = $paraList
            $result.Text = $allText.ToString()
            $result.Headings = $headingList
        } finally {
            $zip.Dispose()
        }
    } catch {
        $result.Error = $_.Exception.Message
    }

    return $result
}

# ---------- 工具函数：根据文本推断危险等级 ----------
function Guess-Class {
    param([string]$Text)
    $t = $Text.ToLower()
    if ($t -match 'apollyon|终结|文明级|末日|灭世|世界末日') { return 'apollyon' }
    if ($t -match 'keter|高危|极危|无法收容|不可控|毁灭') { return 'keter' }
    if ($t -match 'euclid|潜在|不确定|未明|未知') { return 'euclid' }
    if ($t -match 'safe|安全|无害|可控|已收容') { return 'safe' }
    if ($t -match 'thaumiel|反制|对抗|工具|武器|用于收容') { return 'thaumiel' }
    return 'neutral'
}

# ---------- 工具函数：从文件名推断编号和代号 ----------
function Parse-Filename {
    param([string]$Filename)
    # 例如："1都市传说 步幅者.docx" → { code='UR-001', name='步幅者' }
    # "11都市传说 克拉肯.docx" → { code='UR-011', name='克拉肯' }
    # "001行动代号：午夜显影 步幅者.docx" → { code='OP-001', name='午夜显影', target='步幅者' }
    # "ECO基金会核心档案.docx" → { code='ORG-ECO', name='ECO基金会' }
    # "OG-P01 白曐.png" → { code='OG-P01', name='白曐' }
    # "第一卷：天坠之始.docx" → { code='ERA-I-01', name='第一卷：天坠之始' }

    $base = [System.IO.Path]::GetFileNameWithoutExtension($Filename)
    return $base
}

# ---------- 主提取逻辑 ----------
function Convert-ParagraphsToHtml {
    param($Paragraphs)

    $sb = New-Object System.Text.StringBuilder
    $inList = $false

    foreach ($p in $Paragraphs) {
        $text = $p.text.Trim()
        if ($text.Length -eq 0) { continue }

        $style = $p.style

        if ($p.isList) {
            if (-not $inList) {
                [void]$sb.AppendLine('<ul>')
                $inList = $true
            }
            [void]$sb.AppendLine("<li>$text</li>")
        } else {
            if ($inList) {
                [void]$sb.AppendLine('</ul>')
                $inList = $false
            }
            if ($style -match '^1$|^Heading1$|^heading 1$|^Title$') {
                [void]$sb.AppendLine("<h2>$text</h2>")
            } elseif ($style -match '^2$|^Heading2$|^heading 2$') {
                [void]$sb.AppendLine("<h3>$text</h3>")
            } else {
                [void]$sb.AppendLine("<p>$text</p>")
            }
        }
    }
    if ($inList) { [void]$sb.AppendLine('</ul>') }

    return $sb.ToString()
}

# ---------- 提取都市传说 ----------
function Extract-UrbanLegends {
    param([string]$BaseDir, [string]$OutDir)

    $srcDir = Join-Path $BaseDir '都市传说\全部文件'
    if (-not (Test-Path $srcDir)) { Write-Warning "未找到：$srcDir"; return }

    $files = Get-ChildItem -Path $srcDir -Filter '*.docx' | Sort-Object Name
    Write-Host "  [都市传说] 共 $($files.Count) 个文件"

    $entries = @()
    $i = 0
    foreach ($f in $files) {
        $i++
        $extracted = Extract-DocxText -Path $f.FullName
        if ($extracted.Error) {
            Write-Host "    [$i/$($files.Count)] 跳过 $($f.Name)：$($extracted.Error)" -ForegroundColor Yellow
            continue
        }

        # 从文件名提取编号和名称：例如 "1都市传说 步幅者"
        $name = $f.BaseName
        $number = ''
        $display = $name
        if ($name -match '^(\d+)\s*都市传说\s*(.*)$') {
            $number = $matches[1]
            $display = $matches[2].Trim()
        }

        $id = 'UR-{0:D3}' -f [int]$number
        $body = Convert-ParagraphsToHtml -Paragraphs $extracted.Paragraphs
        $class = Guess-Class -Text $extracted.Text

        # 摘要：第一段非标题文本
        $summary = ''
        foreach ($p in $extracted.Paragraphs) {
            if (-not $p.isList -and $p.style -notmatch 'Heading|Title' -and $p.text.Trim().Length -gt 0) {
                $summary = $p.text.Trim()
                if ($summary.Length -gt 120) { $summary = $summary.Substring(0, 120) + '...' }
                break
            }
        }

        $entries += [pscustomobject]@{
            id = $id
            code = $display
            title = $display
            class = $class
            summary = $summary
            tags = @('都市传说')
            source = "都市传说/全部文件/$($f.Name)"
            body = $body
        }

        Write-Host "    [$i/$($files.Count)] $id · $display" -ForegroundColor Green
    }

    $outPath = Join-Path $OutDir 'anomalies-urban.json'
    $entries | ConvertTo-Json -Depth 10 | Out-File -FilePath $outPath -Encoding utf8
    Write-Host "  → 已输出：$outPath ($($entries.Count) 条)"
}

# ---------- 提取行动代号 ----------
function Extract-Operations {
    param([string]$BaseDir, [string]$OutDir)

    $srcDir = Join-Path $BaseDir '行动代号'
    if (-not (Test-Path $srcDir)) { Write-Warning "未找到：$srcDir"; return }

    $files = Get-ChildItem -Path $srcDir -Filter '*.docx' | Sort-Object Name
    Write-Host "  [行动代号] 共 $($files.Count) 个文件"

    $entries = @()
    $i = 0
    foreach ($f in $files) {
        $i++
        $extracted = Extract-DocxText -Path $f.FullName
        if ($extracted.Error) {
            Write-Host "    [$i/$($files.Count)] 跳过 $($f.Name)：$($extracted.Error)" -ForegroundColor Yellow
            continue
        }

        # 从文件名提取：例如 "001行动代号：午夜显影 步幅者"
        $name = $f.BaseName
        $number = ''
        $opName = ''
        $target = ''
        if ($name -match '^(\d+)\s*行动代号[：:]\s*(.+?)(?:\s+(\S+))?$') {
            $number = $matches[1]
            $opName = $matches[2].Trim()
            if ($matches.Count -ge 4 -and $matches[3]) { $target = $matches[3].Trim() }
        } elseif ($name -match '^(\d+)\s*行动代号[：:]\s*(.+)$') {
            $number = $matches[1]
            $opName = $matches[2].Trim()
        } elseif ($name -match '^(\d+)\s*行动档案[：:]\s*(.+)$') {
            $number = $matches[1]
            $opName = $matches[2].Trim()
        }

        $id = 'OP-{0:D3}' -f [int]$number
        $body = Convert-ParagraphsToHtml -Paragraphs $extracted.Paragraphs
        $class = Guess-Class -Text $extracted.Text

        $display = $opName
        if ($target) { $display = "$opName · $target" }

        $summary = ''
        foreach ($p in $extracted.Paragraphs) {
            if (-not $p.isList -and $p.style -notmatch 'Heading|Title' -and $p.text.Trim().Length -gt 0) {
                $summary = $p.text.Trim()
                if ($summary.Length -gt 120) { $summary = $summary.Substring(0, 120) + '...' }
                break
            }
        }

        $entries += [pscustomobject]@{
            id = $id
            code = $opName
            title = $display
            class = $class
            summary = $summary
            tags = @('行动代号', '机密')
            source = "行动代号/$($f.Name)"
            body = $body
        }

        Write-Host "    [$i/$($files.Count)] $id · $display" -ForegroundColor Green
    }

    $outPath = Join-Path $OutDir 'anomalies-operations.json'
    $entries | ConvertTo-Json -Depth 10 | Out-File -FilePath $outPath -Encoding utf8
    Write-Host "  → 已输出：$outPath ($($entries.Count) 条)"
}

# ---------- 提取组织核心档案 ----------
function Extract-Organizations {
    param([string]$BaseDir, [string]$OutDir)

    $srcDir = Join-Path $BaseDir '红月之下\核心档案'
    if (-not (Test-Path $srcDir)) { Write-Warning "未找到：$srcDir"; return }

    $files = Get-ChildItem -Path $srcDir -Filter '*.docx' | Sort-Object Name
    Write-Host "  [组织档案] 共 $($files.Count) 个文件"

    $entries = @()
    $i = 0
    foreach ($f in $files) {
        $i++
        $extracted = Extract-DocxText -Path $f.FullName
        if ($extracted.Error) {
            Write-Host "    [$i/$($files.Count)] 跳过 $($f.Name)：$($extracted.Error)" -ForegroundColor Yellow
            continue
        }

        $name = $f.BaseName -replace '核心档案\s*$',''
        # 从名称提取代号：例如 "永恒钻探公司（Eternal Drilling Corporation, EDC）核心档案"
        $code = ''
        $title = $name
        if ($name -match '（([^（）]+),\s*([A-Z]+)）') {
            $code = $matches[2]
        } elseif ($name -match '（([A-Z]+)）') {
            $code = $matches[1]
        } elseif ($name -match '\b([A-Z]{3,})\b') {
            $code = $matches[1]
        }

        # 生成 id
        $id = if ($code) { "ORG-$code" } else { "ORG-{0:D3}" -f $i }

        $body = Convert-ParagraphsToHtml -Paragraphs $extracted.Paragraphs
        $class = 'thaumiel'  # 组织默认为反制类
        if ($name -match '雇佣兵|教|恐怖|犯罪') { $class = 'euclid' }
        if ($name -match '政府') { $class = 'safe' }

        $summary = ''
        foreach ($p in $extracted.Paragraphs) {
            if (-not $p.isList -and $p.style -notmatch 'Heading|Title' -and $p.text.Trim().Length -gt 0) {
                $summary = $p.text.Trim()
                if ($summary.Length -gt 120) { $summary = $summary.Substring(0, 120) + '...' }
                break
            }
        }

        $entries += [pscustomobject]@{
            id = $id
            code = $code
            title = $name
            class = $class
            summary = $summary
            tags = @('组织', '档案')
            source = "红月之下/核心档案/$($f.Name)"
            body = $body
        }

        Write-Host "    [$i/$($files.Count)] $id · $name" -ForegroundColor Green
    }

    $outPath = Join-Path $OutDir 'organizations.json'
    $entries | ConvertTo-Json -Depth 10 | Out-File -FilePath $outPath -Encoding utf8
    Write-Host "  → 已输出：$outPath ($($entries.Count) 条)"
}

# ---------- 提取组织时间线 ----------
function Extract-Timelines {
    param([string]$BaseDir, [string]$OutDir)

    $srcDir = Join-Path $BaseDir '红月之下\组织时间线'
    if (-not (Test-Path $srcDir)) { Write-Warning "未找到：$srcDir"; return }

    $files = Get-ChildItem -Path $srcDir -Filter '*.docx' | Sort-Object Name
    Write-Host "  [组织时间线] 共 $($files.Count) 个文件"

    $entries = @()
    $i = 0
    foreach ($f in $files) {
        $i++
        $extracted = Extract-DocxText -Path $f.FullName
        if ($extracted.Error) {
            Write-Host "    [$i/$($files.Count)] 跳过 $($f.Name)：$($extracted.Error)" -ForegroundColor Yellow
            continue
        }

        $name = $f.BaseName -replace '时间线\s*$',''
        $code = ''
        $org = $name
        if ($name -match '（([^（）]+),\s*([A-Z]+)）') {
            $code = $matches[2]
            $org = ($name -replace '（[^（）]+）','').Trim()
        } elseif ($name -match '（([A-Z]+)）') {
            $code = $matches[1]
            $org = ($name -replace '（[^（）]+）','').Trim()
        }

        $id = if ($code) { "TL-$code" } else { "TL-{0:D3}" -f $i }
        $body = Convert-ParagraphsToHtml -Paragraphs $extracted.Paragraphs

        $summary = ''
        foreach ($p in $extracted.Paragraphs) {
            if (-not $p.isList -and $p.style -notmatch 'Heading|Title' -and $p.text.Trim().Length -gt 0) {
                $summary = $p.text.Trim()
                if ($summary.Length -gt 120) { $summary = $summary.Substring(0, 120) + '...' }
                break
            }
        }

        $entries += [pscustomobject]@{
            id = $id
            org = $org
            code = $code
            title = "$org 时间线"
            summary = $summary
            source = "红月之下/组织时间线/$($f.Name)"
            body = $body
        }

        Write-Host "    [$i/$($files.Count)] $id · $org" -ForegroundColor Green
    }

    $outPath = Join-Path $OutDir 'timelines.json'
    $entries | ConvertTo-Json -Depth 10 | Out-File -FilePath $outPath -Encoding utf8
    Write-Host "  → 已输出：$outPath ($($entries.Count) 条)"
}

# ---------- 提取纪元卷宗 ----------
function Extract-Eras {
    param([string]$BaseDir, [string]$OutDir)

    # 纪元子目录映射
    $eraDirs = @(
        @{ path = '世界观目前\第一纪元'; era = '第一纪元'; prefix = 'ERA-I-'; cat = 'era-1' }
        @{ path = '世界观目前\第二纪元'; era = '第二纪元'; prefix = 'ERA-II-'; cat = 'era-2' }
        @{ path = '世界观目前\新建文件夹 (2)\1'; era = '第一纪元'; prefix = 'ERA-I-'; cat = 'era-1' }
        @{ path = '世界观目前\新建文件夹 (2)\2'; era = '第二纪元'; prefix = 'ERA-II-'; cat = 'era-2' }
        @{ path = '世界观目前\新建文件夹 (2)\3'; era = '第三纪元'; prefix = 'ERA-III-'; cat = 'era-3' }
    )

    # 喀尔迦书单独处理
    $krgDir = Join-Path $BaseDir '世界观目前\新建文件夹 (2)'
    $allEntries = @()

    # 处理纪元子目录
    foreach ($eraInfo in $eraDirs) {
        $fullPath = Join-Path $BaseDir $eraInfo.path
        if (-not (Test-Path $fullPath)) { continue }

        $files = Get-ChildItem -Path $fullPath -Filter '*.docx' | Sort-Object Name
        if ($files.Count -eq 0) { continue }

        Write-Host "  [纪元卷宗/$($eraInfo.era)] $($eraInfo.path) 共 $($files.Count) 个文件"

        $i = 0
        foreach ($f in $files) {
            $i++
            $extracted = Extract-DocxText -Path $f.FullName
            if ($extracted.Error) {
                Write-Host "    [$i/$($files.Count)] 跳过 $($f.Name)：$($extracted.Error)" -ForegroundColor Yellow
                continue
            }

            $id = "$($eraInfo.prefix){0:D2}" -f $i
            $body = Convert-ParagraphsToHtml -Paragraphs $extracted.Paragraphs

            $summary = ''
            foreach ($p in $extracted.Paragraphs) {
                if (-not $p.isList -and $p.style -notmatch 'Heading|Title' -and $p.text.Trim().Length -gt 0) {
                    $summary = $p.text.Trim()
                    if ($summary.Length -gt 120) { $summary = $summary.Substring(0, 120) + '...' }
                    break
                }
            }

            $allEntries += [pscustomobject]@{
                id = $id
                era = $eraInfo.era
                code = $id
                title = $f.BaseName
                summary = $summary
                source = "$($eraInfo.path)/$($f.Name)"
                body = $body
            }

            Write-Host "    [$i/$($files.Count)] $id · $($f.BaseName)" -ForegroundColor Green
        }
    }

    # 喀尔迦书章节（位于"新建文件夹 (2)"根目录，文件名以"第X章"开头）
    if (Test-Path $krgDir) {
        $krgFiles = Get-ChildItem -Path $krgDir -Filter '第*章*.docx' | Sort-Object Name
        Write-Host "  [喀尔迦书] 共 $($krgFiles.Count) 个章节"

        $i = 0
        foreach ($f in $krgFiles) {
            $i++
            $extracted = Extract-DocxText -Path $f.FullName
            if ($extracted.Error) {
                Write-Host "    [$i/$($krgFiles.Count)] 跳过 $($f.Name)：$($extracted.Error)" -ForegroundColor Yellow
                continue
            }

            $id = "ERA-KRG-{0:D2}" -f $i
            $body = Convert-ParagraphsToHtml -Paragraphs $extracted.Paragraphs

            $summary = ''
            foreach ($p in $extracted.Paragraphs) {
                if (-not $p.isList -and $p.style -notmatch 'Heading|Title' -and $p.text.Trim().Length -gt 0) {
                    $summary = $p.text.Trim()
                    if ($summary.Length -gt 120) { $summary = $summary.Substring(0, 120) + '...' }
                    break
                }
            }

            $allEntries += [pscustomobject]@{
                id = $id
                era = '喀尔迦书'
                code = $id
                title = $f.BaseName
                summary = $summary
                source = "世界观目前/新建文件夹 (2)/$($f.Name)"
                body = $body
            }

            Write-Host "    [$i/$($krgFiles.Count)] $id · $($f.BaseName)" -ForegroundColor Green
        }
    }

    # 灾变纪
    $cataFile = Join-Path $BaseDir '世界观目前\灾变纪：从理性黄昏到红月黎明.docx'
    if (Test-Path $cataFile) {
        Write-Host "  [灾变纪] 单独文件"
        $extracted = Extract-DocxText -Path $cataFile
        if (-not $extracted.Error) {
            $body = Convert-ParagraphsToHtml -Paragraphs $extracted.Paragraphs
            $summary = ''
            foreach ($p in $extracted.Paragraphs) {
                if (-not $p.isList -and $p.style -notmatch 'Heading|Title' -and $p.text.Trim().Length -gt 0) {
                    $summary = $p.text.Trim()
                    if ($summary.Length -gt 120) { $summary = $summary.Substring(0, 120) + '...' }
                    break
                }
            }
            $allEntries += [pscustomobject]@{
                id = 'ERA-CATA-01'
                era = '灾变纪'
                code = 'ERA-CATA-01'
                title = '灾变纪：从理性黄昏到红月黎明'
                summary = $summary
                source = '世界观目前/灾变纪：从理性黄昏到红月黎明.docx'
                body = $body
            }
            Write-Host "    [1/1] ERA-CATA-01 · 灾变纪：从理性黄昏到红月黎明" -ForegroundColor Green
        }
    }

    $outPath = Join-Path $OutDir 'eras.json'
    $allEntries | ConvertTo-Json -Depth 10 | Out-File -FilePath $outPath -Encoding utf8
    Write-Host "  → 已输出：$outPath ($($allEntries.Count) 条)"
}

# ---------- 提取神祇（仅元数据，图片已复制） ----------
function Extract-Deities {
    param([string]$BaseDir, [string]$OutDir)

    $srcDir = Join-Path $BaseDir '世界观目前\神'
    if (-not (Test-Path $srcDir)) { Write-Warning "未找到：$srcDir"; return }

    $files = Get-ChildItem -Path $srcDir -Filter '*.png' | Sort-Object Name
    Write-Host "  [神祇图鉴] 共 $($files.Count) 个图片"

    $entries = @()
    $i = 0
    foreach ($f in $files) {
        $i++
        # 文件名格式："OG-P01 白曐.png"
        $name = $f.BaseName
        $code = ''
        $title = $name
        if ($name -match '^(OG-[A-Z]\d+)\s+(.+)$') {
            $code = $matches[1]
            $title = $matches[2].Trim()
        }

        $id = if ($code) { "DEI-$($code -replace 'OG-','')" } else { "DEI-{0:D2}" -f $i }

        $entries += [pscustomobject]@{
            id = $id
            code = $code
            title = $title
            summary = '神祇档案待补完'
            img = "deities/$($f.Name)"
            body = '<p>神祇详细档案待整理。</p>'
        }

        Write-Host "    [$i/$($files.Count)] $id · $title" -ForegroundColor Green
    }

    $outPath = Join-Path $OutDir 'deities.json'
    $entries | ConvertTo-Json -Depth 10 | Out-File -FilePath $outPath -Encoding utf8
    Write-Host "  → 已输出：$outPath ($($entries.Count) 条)"
}

# ---------- 主入口 ----------
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " 世界观 docx → JSON 提取脚本" -ForegroundColor Cyan
Write-Host " 源目录：$Source" -ForegroundColor Cyan
Write-Host " 输出目录：$OutDir" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
}

Write-Host "`n[1/6] 提取都市传说..." -ForegroundColor Cyan
Extract-UrbanLegends -BaseDir $Source -OutDir $OutDir

Write-Host "`n[2/6] 提取行动代号..." -ForegroundColor Cyan
Extract-Operations -BaseDir $Source -OutDir $OutDir

Write-Host "`n[3/6] 提取组织核心档案..." -ForegroundColor Cyan
Extract-Organizations -BaseDir $Source -OutDir $OutDir

Write-Host "`n[4/6] 提取组织时间线..." -ForegroundColor Cyan
Extract-Timelines -BaseDir $Source -OutDir $OutDir

Write-Host "`n[5/6] 提取纪元卷宗..." -ForegroundColor Cyan
Extract-Eras -BaseDir $Source -OutDir $OutDir

Write-Host "`n[6/6] 提取神祇元数据..." -ForegroundColor Cyan
Extract-Deities -BaseDir $Source -OutDir $OutDir

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " 提取完成！输出目录：$OutDir" -ForegroundColor Cyan
Write-Host " 下一步：运行 merge-manifest.ps1 合并到 manifest.js" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
