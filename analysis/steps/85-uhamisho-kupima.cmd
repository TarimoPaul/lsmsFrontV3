@echo off
rem HATUA 85 (mmiliki 10/11 el/eo; 13/11 hk/hl) - PROD (2.5.0): uhamisho wa KUPIMA (mipangilio + vipande vya bandia + chupa iliyo wazi kwa ml zilizohesabiwa). KAGUA (faida kwa chupa, ONYO <= 10%) -> soma log -> ANDIKA asubuhi kabla ya duka kufunguliwa. Maelezo: 85-uhamisho-kupima.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp085-uhamisho-kupima.ps1" %*
exit /b %ERRORLEVEL%
