@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules" (
  echo Installing dependencies...
  call npm install --production --silent 2>nul
)
node src\index.js %*
