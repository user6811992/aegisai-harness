# AegisAi Harness — Desktop Launcher (PowerShell)
# Opens the web UI in a dedicated app window (Edge/Chrome).
param(
    [int]$Port = 8080,
    [string]$Host = '127.0.0.1'
)

$Url = "http://${Host}:${Port}"

# Check if server is already running
try {
    $resp = Invoke-WebRequest -Uri "$Url/api/version" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($resp.StatusCode -ne 200) { throw "not running" }
} catch {
    Write-Host "Starting AegisAi Harness server..."
    Start-Process -FilePath "aegisai-harness" -ArgumentList "--web" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

# Find a Chromium-based browser
$browser = $null
$paths = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)
foreach ($p in $paths) {
    if (Test-Path $p) { $browser = $p; break }
}

if ($browser) {
    Start-Process -FilePath $browser -ArgumentList "--app=$Url", "--window-size=1280,800", "--window-position=100,100"
} else {
    Start-Process $Url
}

Write-Host "AegisAi Harness launched at $Url"