@echo off
REM Start the QR-MedSecure services (Express API + Vite website).
REM Safe to run repeatedly: a service that is already listening is skipped.
setlocal
cd /d "%~dp0"

call :check 5000
if errorlevel 1 (
  echo Starting Express API on :5000...
  start "QR-MedSecure API :5000" /min /D "%~dp0server" cmd /k npm start
) else (
  echo Express API already running on :5000.
)

call :check 5173
if errorlevel 1 (
  echo Starting website on :5173...
  start "QR-MedSecure Web :5173" /min /D "%~dp0" cmd /k npm run dev
) else (
  echo Website already running on :5173.
)

call :check 8000
if errorlevel 1 (
  if exist "%~dp0start-iot-api.cmd" (
    echo Starting Django IoT API on :8000...
    start "QR-MedSecure IoT :8000" /min /D "%~dp0" cmd /k start-iot-api.cmd
  )
) else (
  echo Django IoT API already running on :8000.
)

exit /b 0

:check
netstat -ano | findstr ":%~1 " | findstr "LISTENING" >nul 2>&1
exit /b %errorlevel%
