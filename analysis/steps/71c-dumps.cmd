@echo off
rem HATUA 71c - DUMPS (mmiliki 29/10 as.0f, at). HAIGUSI DB yoyote iliyopo (prod, staging, wala PG ya local): restore test
rem   inafanywa kwenye PG ya KUTUPWA (initdb kwenye %TEMP%, port 55480, inafutwa mwishoni).
rem   Kinga: log ya 71b lazima iwe na B2_LIFECYCLE_SALAMA na iishie ---OK--- (at), vinginevyo hakuna kinachoendeshwa.
rem   0) (ay) kusoma B2 kwanza: evidence iliyoko B2 yenye sha256 (.sha256) NA SHA1 ya B2 = za PC -> TAYARI, haipakiwi tena
rem   1) evidence (at): dumps 6 za PC ambazo huenda ndizo nakala pekee -> B2 archive/evidence/ (--immutable), kupakua tena,
rem      sha256 = ya PC: 30/09, 04/10, 29/09, 27/09, dump-Lsms-202607171654.sql, BACKUPS AWS\backup_20260205_053622.sql
rem   2) Q-2: dumps 2 mpya zaidi za B2 daily/ -> backups\ (sha256 server = PC)
rem   3) restore test ya kila dump mpya: pg_restore --exit-on-error, Flyway >= 134 (aw: dump ya kabla ya deploy ya 2.3.0
rem      ni 134) na kila migration iliyopo success (FLYWAY_ZILIZOSHINDWA 0), users/sales > 0 (71c-restore-check.sql)
rem   4) KITUO: SAFISHA -> futa PC: kila faili la evidence lililothibitishwa B2, na 14/10 + 15/10 (ikiwa 2 na 3 ni sawa)
rem Server: analysis\steps\71c-dumps.sh. Matokeo: analysis\steps\71c-dumps.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\71c-dumps.log
set "B71=analysis\steps\71b-soma.log"
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set "DUKA=D:\MY PROJECT\DUKA PROJECT"
set "BK=D:\MY PROJECT\DUKA PROJECT\backups"
set "PGB=C:\Program Files\PostgreSQL\17\bin"
set "W=%TEMP%\lsms-71c"
set STEP=
set RC=
set "JIBU="
set "N1="
set "N2="
set "EVN=0"
set "EVT=0"
set "HALI=analysis\steps\71c-hali.txt"
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-71c--- > %L%
echo %date% %time% >> %L%
set "NIMEPATA="
call :mstari_pekee "%B71%" B2_LIFECYCLE_SALAMA
if defined NIMEPATA (
  set "NIMEPATA="
  call :mwisho_ni "%B71%" ---OK---
)
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya 71b haina B2_LIFECYCLE_SALAMA au haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: 71b haijasema B2_LIFECYCLE_SALAMA. Endesha 71b kwanza, kisha nitumie log yake.
  goto end
)
echo 71b: B2_LIFECYCLE_SALAMA >> %L%
if exist "%W%" rd /s /q "%W%"
mkdir "%W%\in"
> "%W%\ev-list.txt" (
  echo %BK%\prod_Lsms_20260930_1026_before_gl.dump
  echo %BK%\lsms_20261004_0200.dump
  echo %BK%\prod_Lsms_20260929_2252.dump
  echo %BK%\prod_Lsms_20260927_2146.dump
  echo %DUKA%\dump-Lsms-202607171654.sql
  echo %DUKA%\BACKUPS AWS\backup_20260205_053622.sql
)
type nul > "%W%\ev-ok.txt"
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "rm -rf /tmp/71c && mkdir -p /tmp/71c/in && echo TMP71C_TAYARI" >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\71c-dumps.sh contabo:/tmp/71c-dumps.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=B2-HALI
echo ---%STEP%--- >> %L%
echo Inasoma hali ya evidence iliyoko B2 - hakuna upload...
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/71c-dumps.sh hali; } 2>&1 | awk %F%" > "%W%\b2hali.txt" 2>&1
set RC=%errorlevel%
type "%W%\b2hali.txt" >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "%W%\b2hali.txt" B2_EV_MWISHO
if not defined NIMEPATA (
  set STEP=ISHARA-B2_EV_MWISHO
  set RC=1
  goto fail
)
for /f "usebackq delims=" %%p in ("%W%\ev-list.txt") do (
  call :ev_prep "%%p"
  if errorlevel 1 goto fail
)
echo evidence TAYARI B2 - hazikupakiwa: %EVT%, zilizotumwa sasa: %EVN% >> %L%
if "%EVN%"=="0" goto ev_hesabu
set STEP=EVIDENCE-B2
echo ---%STEP%--- >> %L%
echo Inapakia evidence %EVN% kwenda B2 na kuzipakua tena kwa ukaguzi - inaweza kuchukua dakika 5-15, USIFUNGE dirisha...
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/71c-dumps.sh evidence; } 2>&1 | awk %F%" > "%W%\ev.txt" 2>&1
set RC=%errorlevel%
type "%W%\ev.txt" >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "%W%\ev.txt" EVIDENCE_B2_SAWA
if not defined NIMEPATA (
  set STEP=ISHARA-EVIDENCE_B2_SAWA
  set RC=1
  goto fail
)
for /f "usebackq tokens=1,2,3" %%a in ("%W%\ev.txt") do if "%%a"=="EVIDENCE_B2_SHA256" call :ev_linganisha %%b %%c
:ev_hesabu
set "EVOK=0"
for /f "usebackq" %%a in ("%W%\ev-ok.txt") do set /a EVOK+=1
set /a EVJ=EVN+EVT
echo evidence zilizothibitishwa B2 = PC: %EVOK% kati ya %EVJ% >> %L%
if not "%EVOK%"=="%EVJ%" (
  set STEP=EVIDENCE-SHA256-B2-SI-SAWA-NA-PC
  set RC=1
  goto fail
)
echo EVIDENCE_PC_NA_B2_SAWA >> %L%
:pakua
set STEP=PAKUA-DUMPS-2-MPYA
echo ---%STEP%--- >> %L%
echo Inatafuta dumps 2 mpya za B2 daily - dakika 1-3...
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/71c-dumps.sh pakua; } 2>&1 | awk %F%" > "%W%\pk.txt" 2>&1
set RC=%errorlevel%
type "%W%\pk.txt" >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "%W%\pk.txt" DUMPS_MPYA_2_SAWA
if not defined NIMEPATA (
  set STEP=ISHARA-DUMPS_MPYA_2_SAWA
  set RC=1
  goto fail
)
for /f "usebackq tokens=1,2,4" %%a in ("%W%\pk.txt") do if "%%a"=="DUMP_MPYA" (
  call :chukua %%b %%c
  if errorlevel 1 goto fail
)
if not defined N2 (
  set STEP=DUMPS-2-HAZIKUPATIKANA
  set RC=1
  goto fail
)
ssh %SSHO% -n contabo "rm -rf /tmp/71c /tmp/71c-dumps.sh /tmp/ficha-lsms.awk && echo /tmp/71c imefutwa" >> %L% 2>&1
for %%n in (%N1% %N2%) do (
  call :restore %%n
  if errorlevel 1 goto fail
)
echo ---RESTORE_TEST_2_SAWA %N1% %N2%--- >> %L%
echo.
type "%W%\rt-%N1%.txt"
type "%W%\rt-%N2%.txt"
echo.
echo ======================== KITUO (STOP) ========================
echo Evidence %EVJ% ziko B2 archive/evidence/ - sha256 B2 = PC kwa kila moja.
echo Dumps mpya %N1% na %N2% ziko backups\ na restore test imepita - hapo juu.
echo Zitafutwa kwenye PC:
for /f "usebackq" %%a in ("%W%\ev-ok.txt") do echo    %%a
echo    lsms_20261014_0200.dump
echo    lsms_20261015_0200.dump
echo Andika SAFISHA kisha Enter ili kufuta. Kitu kingine chochote = simama.
echo ===============================================================
set /p "JIBU=Jibu: "
if not "%JIBU%"=="SAFISHA" (
  echo ---IMESIMAMA-KWA-MMILIKI: hakuna dump iliyofutwa--- >> %L%
  echo Umesimama. Hakuna dump iliyofutwa.
  goto end
)
echo ---MMILIKI-AMEANDIKA-SAFISHA %date% %time%--- >> %L%
set STEP=FUTA
echo ---%STEP%--- >> %L%
for /f "usebackq delims=" %%p in ("%W%\ev-list.txt") do call :futa_ev "%%p"
for %%f in (lsms_20261014_0200.dump lsms_20261015_0200.dump) do call :futa_moja "%BK%\%%f"
rd "%DUKA%\BACKUPS AWS" 2> nul && echo folda tupu BACKUPS AWS imeondolewa >> %L%
findstr /b /c:"KOSA:" %L% > nul
if not errorlevel 1 (
  set STEP=KUFUTA
  set RC=1
  goto fail
)
dir /b "%BK%" >> %L%
echo ---OK--- >> %L%
echo OK - evidence %EVJ% B2, dumps mpya 2 zimethibitishwa, za zamani zimefutwa. Matokeo: %L%. Nitumie log.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -rf /tmp/71c /tmp/71c-dumps.sh /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Hakuna dump iliyofutwa. Nitumie log.
:end
if exist "%W%\pg\postmaster.pid" "%PGB%\pg_ctl.exe" -D "%W%\pg" -m fast stop > nul 2>&1
if exist "%W%" rd /s /q "%W%"
set "JIBU="
endlocal
goto :eof

rem :sha <faili> -> HSH = sha256 (herufi ndogo)
:sha
set "HSH="
for /f "usebackq delims=" %%h in (`powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 -LiteralPath '%~1').Hash.ToLower()"`) do set "HSH=%%h"
exit /b 0

rem :ev_prep <njia> - ikiwa ipo: sha256 -> in\<jina>.sha256, scp faili + sha256 kwenda /tmp/71c/in/. Haipo = imeshafutwa.
:ev_prep
set "STEP=EVIDENCE-TUMA-%~nx1"
if not exist "%~1" (
  echo TAYARI: %~nx1 haipo PC >> %L%
  exit /b 0
)
echo   sha256/sha1 ya %~nx1 ...
call :sha "%~1"
if not defined HSH (
  set RC=1
  exit /b 1
)
set "H1="
for /f "usebackq delims=" %%h in (`powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA1 -LiteralPath '%~1').Hash.ToLower()"`) do set "H1=%%h"
set "B2S="
set "B2H1="
for /f "usebackq tokens=1-4" %%a in ("%W%\b2hali.txt") do if "%%a"=="B2_EV" if "%%b"=="%~nx1" (set "B2S=%%c" & set "B2H1=%%d")
if "%B2S%"=="%HSH%" if "%B2H1%"=="%H1%" (
  echo TAYARI-B2: %~nx1 sha256 %HSH% sha1 %H1% - haipakiwi tena >> %L%
  echo %~nx1>> "%W%\ev-ok.txt"
  set /a EVT+=1
  exit /b 0
)
if defined B2S echo B2 ina %~nx1 lakini sha256 %B2S% / sha1 %B2H1% si za PC - inapakiwa ili --immutable ikatae >> %L%
echo   kutuma %~nx1 ...
echo %HSH%  %~nx1> "%W%\in\%~nx1.sha256"
echo PC %~nx1 %HSH% >> %L%
scp %SSHO% "%~1" "%W%\in\%~nx1.sha256" contabo:/tmp/71c/in/ >> %L% 2>&1
if errorlevel 1 (
  set RC=1
  exit /b 1
)
set /a EVN+=1
exit /b 0

rem :ev_linganisha <jina> <sha256 ya B2> - ikiwa = sha256 ya PC, jina linaongezwa ev-ok.txt
:ev_linganisha
set "PH="
if exist "%W%\in\%~1.sha256" for /f "usebackq tokens=1" %%h in ("%W%\in\%~1.sha256") do set "PH=%%h"
if defined PH if "%PH%"=="%~2" (
  echo %~1>> "%W%\ev-ok.txt"
  exit /b 0
)
echo SIYO: %~1 B2 %~2 si sawa na PC %PH% >> %L%
exit /b 0

rem :futa_ev <njia> - inafuta faili la evidence IKIWA tu jina lake liko ev-ok.txt (B2 = PC)
:futa_ev
set "NIMEPATA="
call :mstari_pekee "%W%\ev-ok.txt" %~nx1
if not defined NIMEPATA (
  if exist "%~1" echo HAIFUTWI: %~nx1 haikuthibitishwa B2 >> %L%
  exit /b 0
)
call :futa_moja "%~1"
exit /b 0

:futa_moja
if not exist "%~1" (
  echo TAYARI: %~nx1 haipo >> %L%
  exit /b 0
)
del "%~1"
if exist "%~1" (echo KOSA: %~nx1 bado ipo >> %L%) else (echo IMEFUTWA %~nx1 >> %L%)
exit /b 0

rem :chukua <jina> <sha256 ya server> - scp kwenda backups\ (ikiwa haipo), sha256 PC = server, N1/N2
:chukua
set "STEP=CHUKUA-%~1"
echo ---%STEP%--- >> %L%
call :sha "%BK%\%~1"
if exist "%BK%\%~1" if "%HSH%"=="%~2" (
  echo %~1 ipo tayari backups\ - sha256 sawa >> %L%
  goto chukua_sawa
)
if exist "%BK%\%~1" (
  echo SIYO: %~1 ipo backups\ lakini sha256 si ya B2 - haiandikwi juu >> %L%
  set RC=1
  exit /b 1
)
scp %SSHO% contabo:/tmp/71c/out/%~1 "%BK%\%~1.tmp" >> %L% 2>&1
if errorlevel 1 (
  set RC=1
  if exist "%BK%\%~1.tmp" del "%BK%\%~1.tmp"
  exit /b 1
)
call :sha "%BK%\%~1.tmp"
if not "%HSH%"=="%~2" (
  echo SIYO: %~1 iliyofika PC si sawa na B2 >> %L%
  del "%BK%\%~1.tmp"
  set RC=1
  exit /b 1
)
move /y "%BK%\%~1.tmp" "%BK%\%~1" > nul
echo %~1 imepakuliwa - sha256 PC = B2 %HSH% >> %L%
:chukua_sawa
if defined N1 (set "N2=%~1") else (set "N1=%~1")
exit /b 0

rem :restore <jina> - PG ya kutupwa: initdb, pg_restore --exit-on-error, 71c-restore-check.sql, Flyway >= 134, users/sales > 0
:restore
set "STEP=RESTORE-TEST-%~1"
call :sha "%BK%\%~1"
if exist "%HALI%" findstr /x /c:"RESTORE_SAWA %~1 %HSH% %date%" "%HALI%" > nul && (
  echo TAYARI: restore test ya %~1 ilipita leo, sha256 ileile - hairudiwi >> %L%
  echo RESTORE_TEST_SAWA %~1 >> %L%
  echo FLYWAY_ZILIZOSHINDWA 0> "%W%\rt-%~1.txt"
  echo TAYARI - restore test ilipita leo>> "%W%\rt-%~1.txt"
  exit /b 0
)
echo Restore test ya %~1 kwenye PG ya kutupwa - dakika 1-2...
echo ---%STEP%--- >> %L%
if exist "%W%\pg" rd /s /q "%W%\pg"
"%PGB%\initdb.exe" -D "%W%\pg" -U postgres -A trust -E UTF8 > "%W%\initdb.txt" 2>&1
if errorlevel 1 (
  type "%W%\initdb.txt" >> %L%
  set RC=1
  exit /b 1
)
"%PGB%\pg_ctl.exe" -D "%W%\pg" -o "-p 55480 -c listen_addresses=127.0.0.1" -l "%W%\pg.log" -w start > nul 2>&1
if errorlevel 1 (
  set RC=1
  exit /b 1
)
"%PGB%\createdb.exe" -h 127.0.0.1 -p 55480 -U postgres rt >> %L% 2>&1
"%PGB%\pg_restore.exe" -h 127.0.0.1 -p 55480 -U postgres -d rt --no-owner --no-privileges --exit-on-error "%BK%\%~1" >> %L% 2>&1
set RC=%errorlevel%
echo [pg_restore exit %RC%] >> %L%
if "%RC%"=="0" "%PGB%\psql.exe" -X -h 127.0.0.1 -p 55480 -U postgres -d rt -At -v ON_ERROR_STOP=1 -f analysis\steps\71c-restore-check.sql > "%W%\rt-%~1.txt" 2>&1
if "%RC%"=="0" set RC=%errorlevel%
"%PGB%\pg_ctl.exe" -D "%W%\pg" -m fast stop > nul 2>&1
rd /s /q "%W%\pg"
if exist "%W%\rt-%~1.txt" (
  echo %~1: >> %L%
  type "%W%\rt-%~1.txt" >> %L%
)
if not "%RC%"=="0" exit /b 1
findstr /b /c:"FLYWAY_ZILIZOSHINDWA 0" "%W%\rt-%~1.txt" > nul || (
  echo SIYO: %~1 ina migrations zilizoshindwa >> %L%
  set RC=1
  exit /b 1
)
rem (aw) Flyway >= 134 kwa namba: toleo la mwisho lazima liwe namba (si "-"), kisha GEQ
findstr /r /c:"^FLYWAY [0-9][0-9]* [0-9][0-9]*$" /c:"^FLYWAY [0-9][0-9]* [0-9][0-9]*\." "%W%\rt-%~1.txt" > nul || (
  echo SIYO: Flyway ya %~1 haina toleo la namba >> %L%
  set RC=1
  exit /b 1
)
set "FV="
for /f "usebackq tokens=1,3 delims=. " %%a in ("%W%\rt-%~1.txt") do if "%%a"=="FLYWAY" set "FV=%%b"
if not defined FV (
  set RC=1
  exit /b 1
)
if %FV% LSS 134 (
  echo SIYO: Flyway ya %~1 ni %FV%, chini ya 134 >> %L%
  set RC=1
  exit /b 1
)
echo Flyway ya %~1: %FV% - sawa, ^>= 134 >> %L%
findstr /r /c:"^ROWS users [1-9][0-9]* sales [1-9]" "%W%\rt-%~1.txt" > nul || (
  echo SIYO: %~1 haina users/sales >> %L%
  set RC=1
  exit /b 1
)
echo RESTORE_TEST_SAWA %~1 >> %L%
call :sha "%BK%\%~1"
echo RESTORE_SAWA %~1 %HSH% %date%>> "%HALI%"
exit /b 0

rem :mstari_pekee "<faili>" <neno> - NIMEPATA=1 ikiwa mstari fulani una <neno> PEKE YAKE (bila kujali nafasi/CR)
:mstari_pekee
setlocal EnableDelayedExpansion
set "CR="
for /f %%a in ('copy /Z "%~f0" nul') do set "CR=%%a"
set "P="
if exist "%~1" for /f "usebackq tokens=1,2" %%A in ("%~1") do (
  set "A=%%A" & set "B=%%B."
  for %%r in ("!CR!") do (set "A=!A:%%~r=!" & set "B=!B:%%~r=!")
  if "!A!"=="%~2" if "!B!"=="." set "P=1"
)
endlocal & set "NIMEPATA=%P%"
goto :eof
rem :mwisho_ni "<faili>" <neno> - NIMEPATA=1 ikiwa mstari wa MWISHO usio tupu ni <neno> PEKE YAKE. Faili lisilokuwepo = HAPANA.
:mwisho_ni
setlocal EnableDelayedExpansion
set "CR="
for /f %%a in ('copy /Z "%~f0" nul') do set "CR=%%a"
set "A="
set "B=."
if exist "%~1" for /f "usebackq tokens=1,2" %%A in ("%~1") do (
  set "A=%%A" & set "B=%%B."
  for %%r in ("!CR!") do (set "A=!A:%%~r=!" & set "B=!B:%%~r=!")
)
set "P="
if "!A!"=="%~2" if "!B!"=="." set "P=1"
endlocal & set "NIMEPATA=%P%"
goto :eof
