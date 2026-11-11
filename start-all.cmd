@echo off
title QR-MedSecure - Start All Services
cd /d "%~dp0"

echo ============================================
echo  QR-MedSecure - starting all services
echo ============================================
echo.

echo [1/3] Express API      -^> http://localhost:5000
start "QR-MedSecure API :5000" /D "%~dp0server" cmd /k npm start

echo [2/3] Website (Vite)   -^> http://localhost:5173
start "QR-MedSecure Web :5173" /D "%~dp0" cmd /k npm run dev

echo [3/3] Django IoT API   -^> http://localhost:8000
if exist "%~dp0start-iot-api.cmd" (
  start "QR-MedSecure IoT :8000" /D "%~dp0" cmd /k start-iot-api.cmd
) else (
  echo       start-iot-api.cmd not found - skipping Django.
)

echo.
echo All services launched in separate windows.
echo Keep those windows open. Close a window to stop that service.
echo.
echo On this PC : http://localhost:5173
echo On the LAN : http://YOUR-LAN-IP:5173
echo.
pause
