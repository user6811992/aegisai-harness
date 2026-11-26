@echo off
:: Set up toolchain PATH
set "TOOLCHAIN_PATH=C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin;C:\Program Files\CMake\bin"
set PATH=%TOOLCHAIN_PATH%;%PATH%

:: Set compiler environment variables
set "CC=C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin\x86_64-w64-mingw32-gcc.exe"
set "CXX=C:\Program Files\LLVM\llvm-mingw-20261117-x86_64\bin\x86_64-w64-mingw32-g++.exe"

:: Run PowerShell script to configure ggml
powershell -ExecutionPolicy Bypass -File "C:\Users\poonjab\Documents\Default Project\repo-clone\configure-ggml.ps1"