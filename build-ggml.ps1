# build-ggml.ps1
# Build ggml native addon for ggml-binding.js

Write-Host "=== ggml Native Addon Build ===" -ForegroundColor Cyan
Write-Host ""

# Verify tools
Write-Host "Checking tools..." -ForegroundColor Yellow
$cmakeVersion = & 'C:\Program Files\CMake\bin\cmake.exe' --version 2>&1
Write-Host "CMake: $cmakeVersion"

$gccPath = 'C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin'
Write-Host "LLVM-MinGW path: $gccPath"

# ggml source directory
$ggmlDir = "C:\Users\poonjab\Documents\Default Project\repo-clone\ggml"
if (-Not (Test-Path $ggmlDir)) {
    Write-Host "ERROR: ggml source not found at $ggmlDir" -ForegroundColor Red
    exit 1
}
Write-Host "ggml source: $ggmlDir" -ForegroundColor Green

# Build directory
$buildDir = "$ggmlDir\build"
if (Test-Path $buildDir) {
    Write-Host "Removing existing build directory..." -ForegroundColor Yellow
    Remove-Item $buildDir -Recurse -Force
}

Write-Host "Configuring ggml with CMake..." -ForegroundColor Yellow
# Configure ggml
$cmakeArgs = @(
    "-B", $buildDir
    "-DGGML_BUILD_EXAMPLES=OFF"
    "-DGGML_BUILD_TESTS=OFF"
    "-DGGML_WITH_BLAS=OFF"
    "-DGGML_WITH_LAPACK=OFF"
    "-DGGML_WITH_THREAD=OFF"
    "-DGGML_WITH_OPENMP=OFF"
)
$cmakeResult = & 'C:\Program Files\CMake\bin\cmake.exe' @cmakeArgs 2>&1
$cmakeExit = $LASTEXITCODE

if ($cmakeExit -ne 0) {
    Write-Host "CMake configuration FAILED" -ForegroundColor Red
    Write-Host "STDOUT: $cmakeResult" -ForegroundColor Red
    exit 1
}

Write-Host "CMake configuration completed successfully" -ForegroundColor Green

Write-Host "Building ggml..." -ForegroundColor Yellow
# Build
$buildResult = & 'C:\Program Files\CMake\bin\cmake.exe' --build $buildDir --config Release 2>&1
$buildExit = $LASTEXITCODE

if ($buildExit -ne 0) {
    Write-Host "Build FAILED" -ForegroundColor Red
    Write-Host "STDOUT: $buildResult" -ForegroundColor Red
    exit 1
}

Write-Host "Build completed successfully" -ForegroundColor Green

# Find the built library
Write-Host "Finding built libraries..." -ForegroundColor Yellow
$libFiles = Get-ChildItem -Path $buildDir -Filter "*.lib" -File -ErrorAction SilentlyContinue
$dllFiles = Get-ChildItem -Path $buildDir -Filter "*.dll" -File -ErrorAction SilentlyContinue
$soFiles = Get-ChildItem -Path $buildDir -Filter "*.so" -File -ErrorAction SilentlyContinue
$aFiles = Get-ChildItem -Path $buildDir -Filter "*.a" -File -ErrorAction SilentlyContinue

Write-Host "  .lib files: $($libFiles.Count)" -ForegroundColor Cyan
foreach ($f in $libFiles) { Write-Host "    $($f.FullName)" -ForegroundColor Gray }

Write-Host "  .dll files: $($dllFiles.Count)" -ForegroundColor Cyan
foreach ($f in $dllFiles) { Write-Host "    $($f.FullName)" -ForegroundColor Gray }

Write-Host "  .a files: $($aFiles.Count)" -ForegroundColor Cyan
foreach ($f in $aFiles) { Write-Host "    $($f.FullName)" -ForegroundColor Gray }

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Cyan
Write-Host "Built libraries are in: $buildDir" -ForegroundColor Cyan
Write-Host "Ready for node-gyp addon build"