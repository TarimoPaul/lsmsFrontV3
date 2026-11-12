@echo off
rem HATUA 93 - deploy 2.5.0 + 3.3.0 (staging = prod; kama 76). Maelezo: 93-deploy-250.ps1. Mfano: 93-deploy-250.cmd staging deploy
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp093-deploy-250.ps1" %*
exit /b %ERRORLEVEL%
