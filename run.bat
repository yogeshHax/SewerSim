@echo off
setlocal EnableExtensions
title SewerSim Launcher
cd /d "%~dp0"

echo ============================================================
echo    SEWERSIM - SEWER NETWORK SIMULATION ^& FAILURE DETECTION
echo    One-click launcher - starts the full application
echo ============================================================
echo.

REM ── 0. Locate the app folder (this bat may sit at repo root) ──
set "APP_DIR=%~dp0"
if exist "%~dp0water-resilience\package.json" set "APP_DIR=%~dp0water-resilience\"
if not exist "%APP_DIR%package.json" (
    echo [ERROR] package.json not found. Run this bat from the project folder.
    goto :fail
)
cd /d "%APP_DIR%"
echo [OK] App folder: %CD%
echo.

REM ── 1. Check Node.js ────────────────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo         Install Node.js 18+ from https://nodejs.org and retry.
    goto :fail
)
for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
echo [OK] Node.js %NODE_VER% detected
echo.

REM ── 2. Install dependencies on first run ────────────────────
if not exist "node_modules" (
    echo [..] First run detected - installing dependencies ^(this can take a few minutes^)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed. Check your internet connection and retry.
        goto :fail
    )
    echo [OK] Dependencies installed
) else (
    echo [OK] Dependencies already installed
)
echo.

REM ── 3. Free port 3000 from any previous run ─────────────────
echo [..] Checking port 3000...
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo [..] Stopping previous instance ^(PID %%p^)...
    taskkill /F /PID %%p >nul 2>nul
)
timeout /t 2 /nobreak >nul
echo [OK] Port 3000 is free
echo.

REM ── 4. Start the application server ─────────────────────────
echo [..] Starting SewerSim server...
start "SewerSim Server" /min cmd /c "npm run dev -- --port 3000 > sewersim-server.log 2>&1"

REM ── 5. Wait until the server actually answers ───────────────
set /a TRIES=0
:waitloop
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 3; exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
    set /a TRIES+=1
    if %TRIES% GEQ 30 (
        echo [ERROR] Server did not respond within 60 seconds.
        echo         Check sewersim-server.log for details.
        goto :fail
    )
    echo      still starting... ^(%TRIES%^)
    goto :waitloop
)
echo [OK] Server is live at http://localhost:3000
echo.

REM ── 6. Open the browser at the home screen ──────────────────
start "" http://localhost:3000
echo ============================================================
echo    SEWERSIM IS RUNNING
echo.
echo    URL:      http://localhost:3000
echo    Server:   minimized window "SewerSim Server"
echo    To stop:  close that window, or run STOP-SewerSim.bat
echo ============================================================
echo.
echo This launcher window can be closed. The server keeps running.
timeout /t 8 /nobreak >nul
exit /b 0

:fail
echo.
echo ============================================================
echo    STARTUP FAILED - see messages above
echo ============================================================
pause
exit /b 1
