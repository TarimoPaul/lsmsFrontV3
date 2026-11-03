@echo off
rem Hatua 72 (mmiliki 03/11 ci): siri za dev -> Lsms\config\application.properties, kisha backend ya release/2.4.0 iwake local.
rem Iendeshwe KABLA ya merge ya release/2.4.0 -> main. KAGUA -> STOP HAMISHA -> STOP ANZA. Log: 72-c1-siri-dev.log
setlocal
python -I "%~dp072-c1-siri-dev.py"
set RC=%ERRORLEVEL%
echo [exit %RC%]
endlocal & exit /b %RC%
