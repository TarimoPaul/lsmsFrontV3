@echo off
rem HATUA 71 - USAFI (mmiliki 29/10 al, am, ao). INABADILISHA PC HII TU (faili, folda, git local) + git origin (tags za
rem   archive na branches 4 zilizomergiwa) + B2 archive/. HAIGUSI prod, staging, DB yoyote, dumps za backups\, Flutter source.
rem   Orodha ya mwisho: analysis\steps\71-orodha.txt (soma kabla). Injini: 71-usafi.py. Server: 71-usafi-b2.sh.
rem   1) zip + sha256 + orodha ya ndani -> D:\LSMS-ARCHIVE (kufungua kwenye folda ya muda na kulinganisha kila faili)
rem   2) zip -> B2 archive/2026-10/ kupitia Contabo, kupakua tena, sha256 sawa
rem   3) KITUO: orodha ya kitakachoondolewa; mmiliki anaandika SAFISHA (kitu kingine = simama, hakuna kilichoondolewa)
rem   4) kuondoa (git rm bila commit - commit ni yako). Ikirudiwa: zip haiundwi upya, inathibitishwa; kilichofanyika = TAYARI.
rem Matokeo: analysis\steps\71-usafi.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\71-usafi.log
set D=D:\LSMS-ARCHIVE
set Z=analysis-archive-2026-10
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set PY=python -I -X utf8 analysis\steps\71-usafi.py
set STEP=
set RC=
set "B2H="
set "JIBU="
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-71--- > %L%
echo %date% %time% >> %L%
set STEP=ANDAA-ZIP
echo ---%STEP%--- >> %L%
echo Inaandaa zip (dakika 1-3)...
%PY% andaa "%D%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
for %%w in (ZIP_SHA256_SAWA ZIP_IMEFUNGULIWA_SAWA ---ANDAA_MWISHO---) do (
  set "NIMEPATA="
  call :mstari_pekee "%L%" %%w
  if not defined NIMEPATA (
    echo SIYO: log haina %%w >> %L%
    set STEP=ISHARA-%%w
    set RC=1
    goto fail
  )
)
findstr /b "FICHA_SAWA" %L% > nul
if errorlevel 1 (
  set STEP=ISHARA-FICHA_SAWA
  set RC=1
  goto fail
)
set STEP=B2-FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
echo Inapakia zip kwenda B2 kupitia Contabo...
ssh %SSHO% -n contabo "rm -rf /tmp/71 && mkdir -p /tmp/71 && echo TMP71_TAYARI" >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% "%D%\%Z%.zip" "%D%\%Z%.zip.sha256" "%D%\%Z%.txt" contabo:/tmp/71/ >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\71-usafi-b2.sh contabo:/tmp/71-usafi-b2.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=SERVER-71-B2
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/71-usafi-b2.sh; R=$?; rm -f /tmp/71-usafi-b2.sh; rm -rf /tmp/71; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
for %%w in (CONTABO_SHA256_SAWA B2_HAKUNA_HATARI B2_SHA256_SAWA ---71_B2_MWISHO---) do (
  set "NIMEPATA="
  call :mstari_pekee "%L%" %%w
  if not defined NIMEPATA (
    echo SIYO: log ya server haina %%w >> %L%
    set STEP=ISHARA-%%w
    set RC=1
    goto fail
  )
)
for /f "usebackq tokens=1,2" %%a in ("%L%") do if "%%a"=="B2_SHA256" set "B2H=%%b"
if not defined B2H (
  set STEP=B2_SHA256-HAIPO
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
set STEP=MUHTASARI
echo ---%STEP%--- >> %L%
%PY% muhtasari "%D%" > analysis\steps\71-muhtasari.txt 2>&1
set RC=%errorlevel%
type analysis\steps\71-muhtasari.txt >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
type analysis\steps\71-muhtasari.txt
echo.
echo ======================== KITUO (STOP) ========================
echo Zip iko %D%\%Z%.zip na B2 archive/2026-10/ - sha256 zote sawa.
echo Hapo juu ni kila kitakachoondolewa (orodha kamili: analysis\steps\71-orodha.txt).
echo Andika SAFISHA kisha Enter ili kuondoa. Kitu kingine chochote = simama, hakuna kinachoondolewa.
echo ===============================================================
set /p "JIBU=Jibu: "
if not "%JIBU%"=="SAFISHA" (
  echo ---IMESIMAMA-KWA-MMILIKI: hakuna kilichoondolewa; zip iko D na B2--- >> %L%
  echo Umesimama. Hakuna kilichoondolewa. Zip iko %D% na B2. Unaweza kuendesha 71 tena baadaye.
  goto end
)
echo ---MMILIKI-AMEANDIKA-SAFISHA %date% %time%--- >> %L%
set STEP=ONDOA
echo ---%STEP%--- >> %L%
echo Inaondoa...
%PY% ondoa "%D%" SAFISHA %B2H% >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "%L%" USAFI_SAWA
if not defined NIMEPATA (
  set STEP=ISHARA-USAFI_SAWA
  set RC=1
  goto fail
)
echo ---OK--- >> %L%
echo OK - usafi umekamilika. Zip: %D%\%Z%.zip + B2. Matokeo: %L%. Faili za git zimeondolewa kwa git rm - commit ni yako. Nitumie log.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -rf /tmp/71 /tmp/ficha-lsms.awk /tmp/71-usafi-b2.sh" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Zip (ikiwa imeundwa) iko %D%. Endesha 71 tena baada ya kurekebisha. Nitumie log.
:end
set "JIBU="
endlocal
goto :eof
rem :mstari_pekee "<faili>" <neno> - NIMEPATA=1 ikiwa mstari fulani wa <faili> una <neno> PEKE YAKE, bila kujali
rem nafasi, tab au CR (CRLF, LF, au bila mwisho wa mstari). Inachukua nafasi ya findstr /x.
:mstari_pekee
setlocal EnableDelayedExpansion
set "CR="
for /f %%a in ('copy /Z "%~f0" nul') do set "CR=%%a"
set "P="
for /f "usebackq tokens=1,2" %%A in ("%~1") do (
  set "A=%%A" & set "B=%%B."
  for %%r in ("!CR!") do (set "A=!A:%%~r=!" & set "B=!B:%%~r=!")
  if "!A!"=="%~2" if "!B!"=="." set "P=1"
)
endlocal & set "NIMEPATA=%P%"
goto :eof
