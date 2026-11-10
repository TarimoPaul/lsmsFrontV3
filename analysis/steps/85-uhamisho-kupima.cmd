@echo off
rem HATUA 85 (mmiliki 10/11 el/eo) - PROD, BAADA ya toleo 2: uhamisho wa KUPIMA (mipangilio + vipande vya bandia + vyombo kwa ml zilizohesabiwa). KAGUA -> soma log -> ANDIKA. Maelezo: 85-uhamisho-kupima.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp085-uhamisho-kupima.ps1" %*
exit /b %ERRORLEVEL%
