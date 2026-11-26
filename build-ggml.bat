@echo off
:: Add toolchain to PATH
set "TOOLCHAIN_PATH=C:\Program Files\CMake\bin;C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin"
set PATH=%TOOLCHAIN_PATH%;%PATH%

set "GGML_DIR=C:\Users\poonjab\Documents\Default Project\repo-clone\ggml"
set "BUILD_DIR=%GGML_DIR%\build"

echo === ggml Native Addon Build ===
echo.

echo Checking tools...
cmake --version >nul 2>&1 && echo CMake found || echo CMake NOT found
if exist "C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin\x86_64-w64-mingw32-g++.exe" echo g++ found || echo g++ NOT found

if not exist "%GGML_DIR%\CMakeLists.txt" (
    echo ERROR: ggml CMakeLists.txt not found at %GGML_DIR%
    pause
    exit /b 1
)

echo.
echo Configuring ggml...
if exist "%BUILD_DIR%" (
    rmdir /s /q "%BUILD_DIR%"
)
cmake -G "MinGW Makefiles" -B "%BUILD_DIR%" -DGGML_BUILD_EXAMPLES=OFF -DGGML_BUILD_TESTS=OFF -DGGML_WITH_BLAS=OFF -DGGML_WITH_LAPACK=OFF -DGGML_WITH_THREAD=OFF -DGGML_WITH_OPENMP=OFF 2>&1 > "%TEMP%\cmake_out.txt"
if %errorlevel% neq 0 (
    echo CMake configuration FAILED
    type "%TEMP%\cmake_out.txt"
    pause
    exit /b 1
)
echo CMake configuration succeeded

echo.
echo Building ggml...
cmake --build "%BUILD_DIR%" --config Release 2>&1 > "%TEMP%\build_out.txt"
if %errorlevel% neq 0 (
    echo Build FAILED
    type "%TEMP%\build_out.txt"
    pause
    exit /b 1
)
echo Build succeeded

echo.
echo Built libraries in: %BUILD_DIR%
dir "%BUILD_DIR%\*.lib" /b 2>nul
dir "%BUILD_DIR%\*.a" /b 2>nul

echo.
echo === Build Complete ===
pause