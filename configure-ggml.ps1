# configure-ggml.ps1
# Configure ggml with CMake for native addon build

Write-Host "=== ggml CMake Configuration ===" -ForegroundColor Cyan
Write-Host ""

# Set paths
$cmakeExe = "C:\Program Files\CMake\bin\cmake.exe"
$ggmlDir = "C:\Users\poonjab\Documents\Default Project\repo-clone\ggml"
$buildDir = "$ggmlDir\build"
$gccFull = "C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin\x86_64-w64-mingw32-gcc.exe"
$gxxFull = "C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin\x86_64-w64-mingw32-g++.exe"
$makeFull = "C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin\mingw32-make.exe"

Write-Host "CMake executable: $cmakeExe" -ForegroundColor Green
Write-Host "ggml source directory: $ggmlDir" -ForegroundColor Green
Write-Host "Build directory: $buildDir" -ForegroundColor Green
Write-Host "C++ compiler: $gxxFull" -ForegroundColor Green
Write-Host "C compiler: $gccFull" -ForegroundColor Green
Write-Host "Make program: $makeFull" -ForegroundColor Green

# Verify ggml CMakeLists.txt exists
if (-Not (Test-Path "$ggmlDir\CMakeLists.txt")) {
    Write-Host "ERROR: ggml CMakeLists.txt not found!" -ForegroundColor Red
    exit 1
}
Write-Host "ggml CMakeLists.txt found" -ForegroundColor Green

# Remove existing build directory
if (Test-Path $buildDir) {
    Write-Host "Removing existing build directory..." -ForegroundColor Yellow
    Remove-Item $buildDir -Recurse -Force
}

# Configure ggml with CMake
Write-Host "Running CMake configuration..." -ForegroundColor Yellow
# Use pushd/popd to set working directory
Write-Host "Changing to ggml directory..." -ForegroundColor DarkYellow
pushd $ggmlDir

Write-Host "Running CMake with full compiler and make program paths..." -ForegroundColor Cyan

# Build the cmake arguments array with full paths
$args = @(
    "-G", "MinGW Makefiles"
    "-B", $buildDir
    "-DGGML_BUILD_EXAMPLES=OFF"
    "-DGGML_BUILD_TESTS=OFF"
    "-DGGML_WITH_BLAS=OFF"
    "-DGGML_WITH_LAPACK=OFF"
    "-DGGML_WITH_THREAD=OFF"
    "-DGGML_WITH_OPENMP=OFF"
    "-DCMAKE_C_COMPILER=$gccFull"
    "-DCMAKE_CXX_COMPILER=$gxxFull"
    "-DCMAKE_MAKE_PROGRAM=$makeFull"
)

Write-Host "Running cmake with:" -ForegroundColor Yellow
$args | ForEach-Object { Write-Host "  $_" -ForegroundColor Cyan }

try {
    & $cmakeExe @args 2>&1 | Out-File -FilePath "$ggmlDir\cmake-config.log" -Encoding UTF8
    $exitCode = $LASTEXITCODE
    
    popd
    
    if ($exitCode -eq 0) {
        Write-Host "CMAKE configuration completed successfully" -ForegroundColor Green
        
        # List built libraries
        Write-Host "Built libraries:" -ForegroundColor Cyan
        $libFiles = Get-ChildItem -Path $buildDir -Filter "*.lib" -File
        $aFiles = Get-ChildItem -Path $buildDir -Filter "*.a" -File
        foreach ($f in $libFiles) { Write-Host "  $($f.Name)" -ForegroundColor Gray }
        foreach ($f in $aFiles) { Write-Host "  $($f.Name)" -ForegroundColor Gray }
        
        # List make program
        $makeFile = "$buildDir\Makefile"
        if (Test-Path $makeFile) {
            Write-Host "Makefile created successfully" -ForegroundColor Green
            $makeContent = Get-Content $makeFile | Select-String "CMAKE_CXX_COMPILER" | ForEach-Object { $_ }
            Write-Host "CMake detected compiler: $makeContent" -ForegroundColor Gray
        }
    } else {
        Write-Host "CMake configuration FAILED (exit code: $exitCode)" -ForegroundColor Red
        Write-Host "Check $ggmlDir\cmake-config.log for details" -ForegroundColor Red
        exit 1
    }
} catch {
    popd
    Write-Host "CMake configuration threw an exception:" -ForegroundColor Red
    Write-Host $_ -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Configuration Complete ===" -ForegroundColor Cyan
Write-Host "Build directory: $buildDir" -ForegroundColor Cyan