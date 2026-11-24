@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [AegisAi] Node.js was not found on PATH.
  echo [AegisAi] Install Node.js 22.13+ (LTS) from https://nodejs.org,
  echo [AegisAi] then reopen this shortcut in a new terminal.
  pause
  exit /b 1
)

node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=13)?0:1)" >nul 2>&1
if errorlevel 1 (
  echo [AegisAi] Node.js 22.13+ is required. Found:
  node --version
  echo [AegisAi] Upgrade from https://nodejs.org and rerun the installer.
  pause
  exit /b 1
)

if not exist ".deps-ok" (
  echo [AegisAi] First run: installing optional dependencies (needs internet once).
  echo [AegisAi] The built-in SQLite backend works even if this step fails.
  call npm install --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    echo [AegisAi] WARNING: dependency install failed; continuing without optional packages.
  ) else (
    echo ok> ".deps-ok"
  )
)

node src\index.js %*
