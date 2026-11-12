@echo off
rem HATUA 60 (fd/fe/ff) - PROD, SIKU YA D: journal ya ufunguzi (salio halisi NMB/Selcom/M-Pesa/Tigo, tofauti ya pesa taslimu) + D. KAGUA -> soma log -> ANDIKA. Maelezo: 60-ufunguzi.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp060-ufunguzi.ps1" %*
exit /b %ERRORLEVEL%
