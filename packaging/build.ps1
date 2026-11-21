# packaging/build.ps1
# Build a release zip of the harness.
param([string]$OutDir = "..\dist")
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$version = (Get-Content (Join-Path $root "package.json") | ConvertFrom-Json).version
$stage = Join-Path $env:TEMP "aegisai-harness-$version"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item -Path (Join-Path $root "src") -Destination $stage -Recurse
Copy-Item -Path (Join-Path $root "package.json") -Destination $stage
Copy-Item -Path (Join-Path $root "README.md") -Destination $stage
Copy-Item -Path (Join-Path $root "ROADMAP.md") -Destination $stage
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$zip = Join-Path $OutDir "aegisai-harness-$version.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip
Write-Host "Built $zip"
