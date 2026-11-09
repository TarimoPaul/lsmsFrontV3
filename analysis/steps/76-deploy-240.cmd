@echo off
rem HATUA 76 - deploy 2.4.0 + 3.2.0 (staging = prod). Maelezo: 76-deploy-240.ps1. Mfano: 76-deploy-240.cmd staging deploy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp076-deploy-240.ps1" %*
exit /b %ERRORLEVEL%
