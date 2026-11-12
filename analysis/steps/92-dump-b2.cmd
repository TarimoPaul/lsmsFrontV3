@echo off
rem HATUA 92 (mmiliki 12/11 ge) - KUSOMA TU: dumps 2 mpya zaidi za prod kutoka B2 -> backups\ (sha256). Haigusi DB yoyote. Maelezo: 92-dump-b2.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp092-dump-b2.ps1" %*
exit /b %ERRORLEVEL%
