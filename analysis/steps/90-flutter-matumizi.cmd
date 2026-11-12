@echo off
rem HATUA 90 (mmiliki 11/11 fa 9) - PROD, KUSOMA TU: matumizi ya Flutter siku 30 (login_audit / audit_trails). Maelezo: 90-flutter-matumizi.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp090-flutter-matumizi.ps1" %*
exit /b %ERRORLEVEL%
