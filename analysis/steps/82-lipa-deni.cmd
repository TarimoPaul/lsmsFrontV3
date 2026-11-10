@echo off
rem HATUA 82 (mmiliki 10/11 eb) - PROD, YA DHARURA: lipa deni 2400 (pango) / 2200 (TRA) bila gharama mpya. KAGUA -> soma log -> ANDIKA. Maelezo: 82-lipa-deni.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp082-lipa-deni.ps1" %*
exit /b %ERRORLEVEL%
