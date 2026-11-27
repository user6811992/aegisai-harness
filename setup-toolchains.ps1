<#
.SYNOPSIS
Setup development toolchains for AegisAi Harness v1.0.17 roadmap items

This script configures available toolchains and attempts to install missing ones
via Windows Package Manager (winget). It sets up the PATH for development workflows.

.AVAILABLE TOOLCHAINS
- CMake: v4.4.4 (Kitware.CMark) - installed
- LLVM-MinGW: v23.1.6-20261117 (MartinStorsjo.LLVM-MinGW.MSVCRT) - installed
- Node.js: LTS v26.13.1 (OpenJS.NodeJS.LTS) - installed
- Rust: NOT installed - requires rustup.rs or winget install
- Python: NOT checked - may be needed for some roadmap items
- Go: NOT checked

.ROADMAP ITEM TOOLCHAIN MAP
1. Rust SDK / Rust runtime        -> rustc/cargo (via rustup or winget)
2. Real ggml/llama.cpp in-process -> CMake + LLVM-MinGW (already installed)
   bindings + native addon        -> ggml source + node-gyp build tools
3. Real Windows UIAutomation     -> Windows SDK (optional, for Automation)
4. MicroVM / K8s / eBPF sandboxing -> Docker, kubectl, eBPF tools
5. WASM sandbox                   -> wasmtime/wasm3, node-gyp
6. Harness generator              -> code generation templates
7. Admin panel                    -> React/Preact, Tailwind
8. Shared resource broker         -> Redis, broker libraries
9. Multi-tenant isolation         -> Logic extensions
10. A2A/ACP protocol adapters      -> Protocol libraries
11. In-process model loading      -> ggml native addon (node-gyp + ggml build)
#

Write-Host "=== AegisAi Harness Toolchain Setup ===" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# 1. Verify currently installed toolchains
# ============================================================
Write-Host "--- Currently Installed Toolchains ---" -ForegroundColor Yellow

Write-Host "CMake:" -ForegroundColor Green
$cmakeResult = & 'C:\Program Files\CMake\bin\cmake.exe' --version 2>&1
Write-Host "  $cmakeResult" -ForegroundColor Gray

Write-Host "LLVM-MinGW:" -ForegroundColor Green
$gxx = & 'C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin\x86_64-w64-mingw32-g++.exe' --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  $($gxx.Split(`n')[0])" -ForegroundColor Gray
} else {
    Write-Host "  Not directly executable from PowerShell - needs CMD or PATH add" -ForegroundColor Yellow
}

Write-Host "Node.js:" -ForegroundColor Green
$nodeResult = & 'node' --version 2>&1
Write-Host "  $nodeResult" -ForegroundColor Gray

# ============================================================
# 2. Install missing toolchains via winget
# ============================================================
Write-Host ""
Write-Host "--- Installing Missing Toolchains ---" -ForegroundColor Yellow

# Try to install Rust (if winget package exists)
Write-Host "Checking for Rust toolchain..." -ForegroundColor Cyan
$rustResult = winget install --id 'rust-lang.rustup' --silent 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Rust installed successfully" -ForegroundColor Green
} else {
    Write-Host "Rust installation status: $rustResult" -ForegroundColor Yellow
    Write-Host "  (may already be installed or requires interactive install)" -ForegroundColor Gray
}

# Check for Go
Write-Host "Checking for Go toolchain..." -ForegroundColor Cyan
$goResult = winget install --id 'go.go' --silent 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Go installed successfully" -ForegroundColor Green
} else {
    Write-Host "Go installation status: $goResult" -ForegroundColor Yellow
}

# Check for Docker (requires WSL or container setup)
Write-Host "Checking for Docker..." -ForegroundColor Cyan
docker ps >nul 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Docker running" -ForegroundColor Green
} else {
    Write-Host "Docker not running (may need WSL2 setup)" -ForegroundColor Yellow
}

# ============================================================
# 3. Configure PATH for development
# ============================================================
Write-Host ""
Write-Host "--- Configuring PATH ---" -ForegroundColor Yellow

$toolchainPath = 'C:\Program Files\CMake\bin'
$llvmPath = 'C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin'
$nodePath = (npm root -g 2>&1) || 'C:\Program Files\nodejs'

# Add to PATH if not already present
$currentPath = $env:PATH
if (-not ($currentPath -match [regex]::Escape($toolchainPath))) {
    $env:PATH = "$toolchainPath;$env:PATH"
    Write-Host "Added CMake to PATH" -ForegroundColor Green
}

if (-not ($currentPath -match [regex]::Escape($llvmPath))) {
    $env:PATH = "$llvmPath;$env:PATH"
    Write-Host "Added LLVM-MinGW to PATH" -ForegroundColor Green
}

# Set CC and CXX environment variables for CMake/ggml builds
$env:CC = "x86_64-w64-mingw32-gcc.exe"
$env:CXX = "x86_64-w64-mingw32-g++.exe"
Write-Host "Set CC=$env:CC and CXX=$env:CXX" -ForegroundColor Green

# Node.js path (check common locations)
$nodeCommonPaths = @(
    'C:\Program Files\nodejs'
    (npm root -g)
)
foreach ($np in $nodeCommonPaths) {
    if (Test-Path $np -and -not ($currentPath -match [regex]::Escape($np))) {
        $env:PATH = "$np;$env:PATH"
        Write-Host "Added Node.js to PATH: $np" -ForegroundColor Green
        break
    }
}

Write-Host ""
Write-Host "Current PATH length: $($env:PATH.Split(';').Count) segments" -ForegroundColor DarkGray
Write-Host "PATH prefix: $($env:PATH.Substring(0,100))..." -ForegroundColor DarkGray

# ============================================================
# 4. Verify final setup
# ============================================================
Write-Host ""
Write-Host "--- Verification ---" -ForegroundColor Cyan

$checks = @()
# CMake
try {
    $cmakeVer = & 'C:\Program Files\CMake\bin\cmake.exe' --version 2>&1
    $checks += [pscustomobject]@{ Name='CMake'; Status='OK'; Detail=$cmakeVer }
} catch {
    $checks += [pscustomobject]@{ Name='CMake'; Status='FAIL'; Detail=$_ }
}

# Node.js
try {
    $nodeVer = & 'node' --version 2>&1
    $checks += [pscustomobject]@{ Name='Node.js'; Status='OK'; Detail=$nodeVer }
} catch {
    $checks += [pscustomobject]@{ Name='Node.js'; Status='FAIL'; Detail=$_ }
}

foreach ($check in $checks) {
    if ($check.Status -eq 'OK') {
        Write-Host "$($check.Name): OK - $($check.Detail)" -ForegroundColor Green
    } else {
        Write-Host "$($check.Name): FAIL - $($check.Detail)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Toolchain Setup Complete ===" -ForegroundColor Cyan
Write-Host "Run: & 'C:\Program Files\CMake\bin\cmake.exe' --version" -ForegroundColor DarkGray
Write-Host "     & 'node' --version" -ForegroundColor DarkGray
Write-Host "     & 'x86_64-w64-mingw32-g++.exe' --version" -ForegroundColor DarkGray
#