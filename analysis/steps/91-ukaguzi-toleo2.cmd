@echo off
rem HATUA 91 (mmiliki 12/11 fi/fj) - PROD, KUSOMA TU: ukaguzi wa mwisho wa toleo 2 (Jagger, Flyway, D, akaunti za pesa, mikopo) + 90 (Flutter). Maelezo: 91-ukaguzi-toleo2.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp091-ukaguzi-toleo2.ps1" %*
exit /b %ERRORLEVEL%
