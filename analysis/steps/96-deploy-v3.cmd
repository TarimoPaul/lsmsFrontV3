@echo off
rem HATUA 96 (mmiliki 13/11 hq/hr) - V3 PEKEE 3.3.0 -> 3.3.1 (KUPIMA kwenye orodha ya POS), prod moja kwa moja; backend 2.5.0 haiguswi. Maelezo: 96-deploy-v3.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp096-deploy-v3.ps1" %*
exit /b %ERRORLEVEL%
