@echo off
rem HATUA 80 (mmiliki 09/11 dq/dr) - PROD: marekebisho ya gharama 2026. KAGUA -> soma log -> ANDIKA a, d, b (c imezuiwa). Maelezo: 80-marekebisho-gharama.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp080-marekebisho-gharama.ps1" %*
exit /b %ERRORLEVEL%
