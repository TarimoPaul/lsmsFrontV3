@echo off
rem HATUA 88 (mmiliki 11/11 ex/ey) - PROD: Dr 1000 200,000 / Cr 6200 (Frame Jan 2026 mara ya 3, row 2939F6DE "2400000"). KAGUA -> soma log -> STOP -> ANDIKA (TU baada ya jibu la Chief). Maelezo: 88-frame-jan-ya-tatu.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp088-frame-jan-ya-tatu.ps1" %*
exit /b %ERRORLEVEL%
