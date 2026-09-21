@echo off
title Stop SewerSim
echo [..] Stopping any SewerSim server on port 3000...
set FOUND=0
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    set FOUND=1
    taskkill /F /PID %%p >nul 2>nul && echo [OK] Stopped process %%p
)
if %FOUND%==0 echo [OK] No SewerSim server is running.
timeout /t 2 /nobreak >nul
exit /b 0
