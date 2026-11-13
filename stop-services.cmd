@echo off
REM Stop the QR-MedSecure services by killing whatever listens on their ports.
REM Usage:
REM   stop-services.cmd            -> stops 5000, 5173 and 8000
REM   stop-services.cmd 5173       -> stops only the website
REM   stop-services.cmd 5000 8000  -> stops only the APIs
setlocal enabledelayedexpansion
set "PORTS=%~1"
if "%PORTS%"=="" set "PORTS=5000 5173 8000"
echo Stopping QR-MedSecure services on port(s): %PORTS%
for %%P in (%PORTS%) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do (
    echo   killing PID %%A on port %%P
    taskkill /PID %%A /F >nul 2>&1
  )
)
echo Done.
