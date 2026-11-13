@echo off
rem HATUA 95 (Chief 13/11 hi 4-5) - PROD, KUSOMA TU: ripoti ya siku ya kwanza (onyo la manunuzi, reco, mauzo, GL, ERROR za log saa 24, hatua 74 KAGUA). Maelezo: 95-siku-ya-kwanza.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp095-siku-ya-kwanza.ps1" %*
exit /b %ERRORLEVEL%
