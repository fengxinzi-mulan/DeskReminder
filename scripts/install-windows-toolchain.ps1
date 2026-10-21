# 一次性安装 Windows 构建工具链。需要以管理员身份运行（VS Build Tools 会触发 UAC）。
$ErrorActionPreference = "Stop"

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "请用管理员身份打开 PowerShell 后重新运行此脚本。" -ForegroundColor Yellow
    Write-Host "只有安装 VS Build Tools 需要管理员权限；Rust 是用户级安装。"
    exit 1
}

Write-Host "安装 Visual Studio 2022 Build Tools（C++ 工作负载 + Windows SDK）..."
winget install --id Microsoft.VisualStudio.2022.BuildTools --accept-source-agreements --accept-package-agreements --override "--quiet --wait --norestart --nocache --installPath E:\VSBuildTools --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"

if (-not (Test-Path "E:\Rust\rustup")) {
    New-Item -ItemType Directory -Force "E:\Rust\rustup" | Out-Null
}
if (-not (Test-Path "E:\Rust\cargo")) {
    New-Item -ItemType Directory -Force "E:\Rust\cargo" | Out-Null
}
$installer = Join-Path $env:TEMP "rustup-init.exe"
Write-Host "下载 rustup..."
Invoke-WebRequest -Uri "https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe" -OutFile $installer
$env:RUSTUP_HOME = "E:\Rust\rustup"
$env:CARGO_HOME = "E:\Rust\cargo"
& $installer -y --profile minimal --default-toolchain stable-x86_64-pc-windows-msvc

[Environment]::SetEnvironmentVariable("RUSTUP_HOME", "E:\Rust\rustup", "User")
[Environment]::SetEnvironmentVariable("CARGO_HOME", "E:\Rust\cargo", "User")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*E:\Rust\cargo\bin*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;E:\Rust\cargo\bin", "User")
}

Write-Host "安装前端依赖..."
Push-Location (Split-Path -Parent $PSScriptRoot)
npm install --no-audit --no-fund
Pop-Location

Write-Host "完成。重新打开终端后运行 scripts\build-windows.ps1。"
