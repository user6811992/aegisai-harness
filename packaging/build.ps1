# Build AegisAi Harness for Windows.
# Usage: .\packaging\build.ps1 [-Binary] [-Installer]
#   -Binary:    build standalone exe via @yao-pkg/pkg (requires network on first run)
#   -Installer: build Inno Setup installer (requires ISCC on PATH)
param([switch]$Binary, [switch]$Installer)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
Set-Location $Root

$Version = (Get-Content package.json | ConvertFrom-Json).version
Write-Host "Building AegisAi Harness v$Version" -ForegroundColor Cyan

New-Item -ItemType Directory -Force -Path dist | Out-Null

# package.json is the single source of truth; mirror the version into the .iss.
$issPath = "packaging\windows\installer.iss"
$iss = Get-Content $issPath -Raw
$updated = $iss -replace 'AppVersion=\d+\.\d+\.\d+', "AppVersion=$Version"
$updated = $updated -replace 'OutputBaseFilename=AegisAi-Harness-[\d.]+-Setup', "OutputBaseFilename=AegisAi-Harness-$Version-Setup"
if ($updated -notmatch "AppVersion=$Version" -or $updated -notmatch "OutputBaseFilename=AegisAi-Harness-$Version-Setup") {
  Write-Error "Failed to update version strings in $issPath"
  exit 1
}
Set-Content $issPath $updated

node scripts/check-version-consistency.js
if ($LASTEXITCODE -ne 0) { Write-Error "Version consistency check failed"; exit 1 }

if ($Binary -or (-not $Installer)) {
  Write-Host "Building standalone binary..." -ForegroundColor Yellow
  # pkg 5 + node22 targets are known to produce broken binaries; use pkg 6 + node24.
  npx --yes @yao-pkg/pkg@6 src/index.js --targets node24-win-x64 --output "dist\aegisai-harness-$Version.exe"
  if ($LASTEXITCODE -ne 0) { Write-Error "pkg build failed"; exit 1 }
  Write-Host "Binary: dist\aegisai-harness-$Version.exe" -ForegroundColor Green
}

if ($Installer) {
  $Iscc = Get-Command iscc -ErrorAction SilentlyContinue
  if (-not $Iscc) { Write-Error "ISCC (Inno Setup) not found on PATH. Install from https://jrsoftware.org/isdl.php"; exit 1 }
  Write-Host "Building Inno Setup installer..." -ForegroundColor Yellow
  & iscc "packaging\windows\installer.iss"
  if ($LASTEXITCODE -ne 0) { Write-Error "Inno Setup build failed"; exit 1 }

  $exe = "dist\AegisAi-Harness-$Version-Setup.exe"
  if (-not (Test-Path $exe)) { Write-Error "Expected installer not found: $exe"; exit 1 }
  $hash = (Get-FileHash $exe -Algorithm SHA256).Hash.ToLowerInvariant()
  "$hash  AegisAi-Harness-$Version-Setup.exe" | Set-Content "dist\AegisAi-Harness-$Version-Setup.exe.sha256"
  Write-Host "Installer: $exe" -ForegroundColor Green
  Write-Host "SHA256: $hash" -ForegroundColor Green
}

Write-Host "Done." -ForegroundColor Green
