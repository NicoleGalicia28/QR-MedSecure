@echo off
REM Stop the QR-MedSecure services by killing whatever listens on their ports.
setlocal enabledelayedexpansion
echo Stopping QR-MedSecure services on ports 5000, 5173 and 8000...
for %%P in (5000 5173 8000) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do (
    echo   killing PID %%A on port %%P
    taskkill /PID %%A /F >nul 2>&1
  )
)
echo Done.
