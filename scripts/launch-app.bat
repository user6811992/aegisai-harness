@echo off
REM AegisAi Harness — Desktop Launcher
REM Opens the web UI in a dedicated app window (Edge/Chrome).
setlocal

set "PORT=8080"
set "HOST=127.0.0.1"
set "URL=http://%HOST%:%PORT%"

REM Start the server in the background if not already running.
curl -s -o nul -w "%%{http_code}" %URL%/api/version 2>nul | findstr /x "200" >nul
if errorlevel 1 (
  echo Starting AegisAi Harness server...
  start /B "" aegisai-harness --web
  timeout /t 3 /nobreak >nul
)

REM Prefer Edge, then Chrome, then default browser.
set "BROWSER="
where msedge >nul 2>&1 && set "BROWSER=msedge"
if not defined BROWSER where chrome >nul 2>&1 && set "BROWSER=chrome"
if not defined BROWSER where chromium >nul 2>&1 && set "BROWSER=chromium"

if defined BROWSER (
  start "" %BROWSER% --app=%URL% --window-size=1280,800 --window-position=100,100
) else (
  start "" %URL%
)

endlocal