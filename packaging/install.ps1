# packaging/install.ps1
# Install the harness to %LOCALAPPDATA%\AegisAiHarness
param([string]$SourceZip)
$ErrorActionPreference = "Stop"
$dest = Join-Path $env:LOCALAPPDATA "AegisAiHarness"
if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
New-Item -ItemType Directory -Path $dest | Out-Null
if ($SourceZip) {
  Expand-Archive -Path $SourceZip -DestinationPath $dest
} else {
  # assume running from repo
  $root = Split-Path -Parent $PSScriptRoot
  Copy-Item -Path (Join-Path $root "src") -Destination $dest -Recurse
  Copy-Item -Path (Join-Path $root "package.json") -Destination $dest
}
# create launcher
$launcher = Join-Path $dest "aegisai-harness.cmd"
Set-Content -Path $launcher -Value "@echo off`nnode `"%~dp0src\index.js`" %*"
Write-Host "Installed to $dest"
Write-Host "Run: $launcher"
