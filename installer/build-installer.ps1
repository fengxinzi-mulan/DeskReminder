$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root "release\DeskReminder.exe"
if (-not (Test-Path $exe)) {
    throw "未找到 release\DeskReminder.exe，请先运行 scripts\build-windows.ps1。"
}

Copy-Item (Join-Path $root "src-tauri\icons\icon.ico") (Join-Path $PSScriptRoot "app.ico") -Force

$makensis = Join-Path $env:LOCALAPPDATA "tauri\NSIS\makensis.exe"
if (-not (Test-Path $makensis)) {
    $nsisDefault = "C:\Program Files (x86)\NSIS\makensis.exe"
    if (Test-Path $nsisDefault) {
        $makensis = $nsisDefault
    }
}
if (-not (Test-Path $makensis)) {
    $cmd = Get-Command makensis.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        $makensis = $cmd.Source
    } else {
        throw "未找到 makensis.exe。请先运行一次 npx tauri build --bundles nsis 下载 NSIS，或安装 NSIS 后重试。"
    }
}

# NSIS 需要 UTF-8 BOM 才能正确识别中文
$nsi = Join-Path $PSScriptRoot "DeskReminder.nsi"
$content = Get-Content -Raw -Encoding UTF8 $nsi
[System.IO.File]::WriteAllText($nsi, $content, (New-Object System.Text.UTF8Encoding($true)))

Push-Location $PSScriptRoot
try {
    & $makensis "DeskReminder.nsi"
    if ($LASTEXITCODE -ne 0) {
        throw "makensis 编译失败，退出码 $LASTEXITCODE"
    }
} finally {
    Pop-Location
}

$output = Join-Path $root "release\DeskReminder-Setup-1.1.0.exe"
if (Test-Path $output) {
    $size = [math]::Round((Get-Item $output).Length / 1MB, 1)
    Write-Host "安装包已生成：release\DeskReminder-Setup-1.1.0.exe ($size MB)"
} else {
    throw "未找到安装包输出文件。"
}
