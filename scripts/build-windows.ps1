$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not $env:RUSTUP_HOME -and (Test-Path "E:\Rust\rustup")) {
    $env:RUSTUP_HOME = "E:\Rust\rustup"
}
if (-not $env:CARGO_HOME -and (Test-Path "E:\Rust\cargo")) {
    $env:CARGO_HOME = "E:\Rust\cargo"
}
$cargoBin = Join-Path $env:CARGO_HOME "bin"
if ($cargoBin -and (Test-Path $cargoBin) -and ($env:Path -notlike "*$cargoBin*")) {
    $env:Path = "$cargoBin;$env:Path"
}

$vcvars = "E:\VSBuildTools\VC\Auxiliary\Build\vcvars64.bat"
if (Test-Path $vcvars) {
    cmd /c "call `"$vcvars`" >nul && set" | ForEach-Object {
        if ($_ -match "^([^=]+)=(.*)$") {
            Set-Item -Path "env:$($matches[1])" -Value $matches[2]
        }
    }
}

Push-Location $root
try {
    npm install --no-audit --no-fund
    npm run build
    npx tauri build --no-bundle

    $candidates = @(
        (Join-Path $root "src-tauri\target\release\DeskReminder.exe"),
        (Join-Path $root "src-tauri\target\release\desk-reminder.exe")
    )
    $exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $exe) {
        throw "没有找到构建输出，请检查 src-tauri\target\release。"
    }

    New-Item -ItemType Directory -Force (Join-Path $root "release") | Out-Null
    Copy-Item $exe (Join-Path $root "release\DeskReminder.exe") -Force
    $size = [math]::Round((Get-Item (Join-Path $root "release\DeskReminder.exe")).Length / 1MB, 1)
    Write-Host "构建完成：release\DeskReminder.exe ($size MB)"
}
finally {
    Pop-Location
}
