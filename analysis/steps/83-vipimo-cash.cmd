@echo off
rem HATUA 83 (mmiliki 10/11 eh) - PROD: Dr 1000 159,000 / Cr 3900 (manunuzi ya vipimo hayakulipwa). KAGUA -> soma log -> STOP -> ANDIKA. Maelezo: 83-vipimo-cash.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp083-vipimo-cash.ps1" %*
exit /b %ERRORLEVEL%
