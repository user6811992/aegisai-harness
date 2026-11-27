# packaging/install.ps1
# Install the harness to %LOCALAPPDATA%\AegisAiHarness without losing user data.
param([string]$SourceZip)
$ErrorActionPreference = "Stop"

$dest = Join-Path $env:LOCALAPPDATA "AegisAiHarness"
$dataPath = Join-Path $dest "data"

# Preserve sessions/memories across reinstalls (the old script deleted them).
$hadData = Test-Path $dataPath
$backup = $null
if ($hadData) {
  $backup = Join-Path $env:TEMP ("aegisai-harness-data-" + (Get-Date -Format yyyyMMddHHmmss))
  New-Item -ItemType Directory -Path $backup | Out-Null
  Copy-Item -Path $dataPath -Destination (Join-Path $backup "data") -Recurse -Force
}

if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest | Out-Null

if ($SourceZip) {
  $stage = Join-Path $env:TEMP ("aegisai-harness-zip-" + (Get-Date -Format yyyyMMddHHmmss))
  Expand-Archive -Force -Path $SourceZip -DestinationPath $stage
  # GitHub source zips contain a single top-level folder; find the actual repo root.
  $candidate = Get-ChildItem -Path $stage -Directory -Recurse |
    Where-Object { (Test-Path (Join-Path $_.FullName "src")) -and (Test-Path (Join-Path $_.FullName "package.json")) } |
    Select-Object -First 1
  if (-not $candidate) { throw "SourceZip does not contain a folder with src/ and package.json" }
  $root = $candidate.FullName
} else {
  $root = Split-Path -Parent $PSScriptRoot
}

Copy-Item -Path (Join-Path $root "src") -Destination $dest -Recurse
Copy-Item -Path (Join-Path $root "public") -Destination $dest -Recurse
Copy-Item -Path (Join-Path $root "scripts") -Destination $dest -Recurse
Copy-Item -Path (Join-Path $root "package.json") -Destination $dest
foreach ($doc in @("README.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "CHANGELOG.md", "llms.txt")) {
  $f = Join-Path $root $doc
  if (Test-Path $f) { Copy-Item -Path $f -Destination $dest }
}

if ($hadData -and (Test-Path (Join-Path $backup "data"))) {
  Copy-Item -Path (Join-Path $backup "data") -Destination $dest -Recurse -Force
}

$launcher = Join-Path $dest "aegisai-harness.cmd"
$launcherText = @'
@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo [AegisAi] Node.js 22.13+ is required but was not found on PATH.
  echo [AegisAi] Install Node.js from https://nodejs.org and reopen this shortcut.
  pause
  exit /b 1
)
node src\index.js %*
'@
Set-Content -Path $launcher -Value $launcherText

Write-Host "Installed to $dest"
Write-Host "Run: $launcher"
