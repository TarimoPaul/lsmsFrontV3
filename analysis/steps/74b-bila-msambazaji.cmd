@echo off
rem HATUA 74b (mmiliki 12/11 gb; 6b) - PROD, BAADA ya toleo 2: manunuzi yote bila msambazaji + UNPAID -> PAID bila journal (GL tayari sahihi). KAGUA -> soma log -> STOP -> ANDIKA. Maelezo: 74b-bila-msambazaji.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp074b-bila-msambazaji.ps1" %*
exit /b %ERRORLEVEL%
