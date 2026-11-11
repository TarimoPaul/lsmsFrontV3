@echo off
rem HATUA 89 (mmiliki 11/11 ew/ex) - PROD, BAADA ya toleo 2 (V145): alama "nje ya ripoti ya uendeshaji" kwa REN-MON Nov 5D9DD844 + TAX-MON Nov B4F8EA66, sababu "zimeshughulikiwa na hatua 80"; GL haiguswi. KAGUA -> soma log -> STOP -> ANDIKA. Maelezo: 89-nje-ya-ripoti.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp089-nje-ya-ripoti.ps1" %*
exit /b %ERRORLEVEL%
