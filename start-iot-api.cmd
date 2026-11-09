@echo off
REM Start the Django IoT API (qr_medsecure_api-main) alongside the main QR-MedSecure backend.
set "DJANGO_DIR=%~dp0..\qr_medsecure_api-main\qr_medsecure_api-main"
if not exist "%DJANGO_DIR%\manage.py" (
  echo Django project not found at: %DJANGO_DIR%
  echo Expected: ..\qr_medsecure_api-main\qr_medsecure_api-main\manage.py
  exit /b 1
)
cd /d "%DJANGO_DIR%"
if exist "venv\Scripts\python.exe" (
  echo Starting Django IoT API on http://0.0.0.0:8000 ...
  venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
) else (
  echo venv not found. Trying system python...
  python manage.py runserver 0.0.0.0:8000
)
