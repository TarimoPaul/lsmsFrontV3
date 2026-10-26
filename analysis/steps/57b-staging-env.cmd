@echo off
rem HATUA 57b - STAGING .env kabla ya 2.2.72 (mmiliki 26/10): ROOT_EMAIL=root@system.com, ROOT_PASSWORD iondolewe. INABADILISHA
rem   ~/lsms-staging/.env TU (backup .env.bak.kabla-ya-2272); prod haiguswi; HAKUNA restart (57c). Inahakikisha pia kwamba DB ya
rem   staging ina root@system.com root ACTIVE (hali-root.sh staging SASA). Script: analysis\steps\57b-staging-env.sh.
rem Lazima kwanza: 57a = [OK] BUILD_OK 2.2.72; staging postgres inawaka. Matokeo: analysis\steps\57b-staging-env.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\57b-staging-env.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-57b--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\57a-hotfix-2272-build.log" ---MWISHO---
if defined NIMEPATA (
  findstr /b /l /c:"[OK] BUILD_OK 2.2.72 " analysis\steps\57a-hotfix-2272-build.log > nul
  if errorlevel 1 set "NIMEPATA="
)
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya 57a haina [OK] BUILD_OK 2.2.72 na ---MWISHO--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: 57a haikuisha na BUILD_OK 2.2.72. 57b haijaendeshwa.
  goto end
)
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\hali-root.sh contabo:/tmp/hali-root.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\57b-staging-env.sh contabo:/tmp/57b-staging-env.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=SERVER-57b
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/57b-staging-env.sh; R=$?; rm -f /tmp/57b-staging-env.sh; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\57b-staging-env.log" ENV_STAGING_2272_SAWA
if not defined NIMEPATA (
  echo SIYO: log ya server haina ENV_STAGING_2272_SAWA >> %L%
  set RC=1
  goto fail
)
echo ---VICHUJIO-VIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/hali-root.sh /tmp/hali-root-staging.kabla && echo vichujio vimefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - .env ya staging: ROOT_EMAIL=root@system.com, ROOT_PASSWORD imeondolewa. Sasa unaweza kuendesha 57c. Matokeo: %L%.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/hali-root.sh /tmp/57b-staging-env.sh" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Hatua zinazofuata HAZIKUENDESHWA. Nitumie log.
:end
endlocal
goto :eof
rem :mstari_pekee "<faili>" <neno> - NIMEPATA=1 ikiwa mstari fulani wa <faili> una <neno> PEKE YAKE, bila kujali
rem nafasi, tab au  (CRLF, LF, au bila mwisho wa mstari). Inachukua nafasi ya findstr /x, ambayo haioni mstari
rem wa mwisho usio na CRLF (ndiyo sababu 36 ilisema "tunnel haijibu 400" wakati faili lina 400).
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
rem :mwisho_ni "<faili>" <neno> - NIMEPATA=1 ikiwa mstari wa MWISHO usio tupu wa <faili> ni <neno> PEKE YAKE
rem (bila kujali nafasi, tab au ). Faili lisilokuwepo = HAPANA.
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
