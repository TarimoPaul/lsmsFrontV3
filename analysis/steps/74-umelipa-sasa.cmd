@echo off
rem HATUA 74 (mmiliki 04/11 ct, 11/11 fa 6a) - PROD, BAADA ya toleo 2: ununuzi 18 (Grepa + 17, Chief fc) -> PAID bila journal (GL tayari sahihi). KAGUA -> soma log -> STOP -> ANDIKA. Maelezo: 74-umelipa-sasa.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp074-umelipa-sasa.ps1" %*
exit /b %ERRORLEVEL%
