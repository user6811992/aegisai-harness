# Build AegisAi Harness for Windows.
# Usage: .\packaging\build.ps1 [-Binary] [-Installer]
#   -Binary:    build standalone exe via pkg (requires network on first run)
#   -Installer: build Inno Setup installer (requires ISCC on PATH)
param([switch]$Binary, [switch]$Installer)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $Root

$Version = (Get-Content package.json | ConvertFrom-Json).version
Write-Host "Building AegisAi Harness v$Version" -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path dist | Out-Null

if ($Binary -or (-not $Installer)) {
  Write-Host "Building standalone binary..." -ForegroundColor Yellow
  npx --yes @yao-pkg/pkg@5 src/index.js --targets node22-win-x64 --output "dist\aegisai-harness-$Version.exe"
  Write-Host "Binary: dist\aegisai-harness-$Version.exe" -ForegroundColor Green
}

if ($Installer) {
  $Iscc = Get-Command iscc -ErrorAction SilentlyContinue
  if (-not $Iscc) { Write-Error "ISCC (Inno Setup) not found on PATH. Install from https://jrsoftware.org/isdl.php"; exit 1 }
  Write-Host "Building Inno Setup installer..." -ForegroundColor Yellow
  & iscc "packaging\windows\installer.iss"
  Write-Host "Installer: dist\AegisAi-Harness-$Version-Setup.exe" -ForegroundColor Green
}

Write-Host "Done." -ForegroundColor Green
