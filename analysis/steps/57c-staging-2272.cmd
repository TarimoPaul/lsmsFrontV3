@echo off
rem HATUA 57c - STAGING inawasha backend 2.2.72 (mmiliki 26/10 b, k, l): kinga ya staging (folda + label za compose; postgres si
rem   ya prod) -^> BACKEND_VERSION 2.2.71 -^> 2.2.72 kwenye .env ya staging (backup .env.bak.kabla-ya-2272-toleo) -^> pull + digest
rem   sha256:ad3c5945...43359a -^> admin@admin.com (id 9) ACTIVE -^> INACTIVE kwenye DB ya STAGING (rows lazima 1) -^> hali-root
rem   KABLA (admin INACTIVE) -^> RESTART HALISI -^> container = digest -^> hali-root BAADA: admin bado INACTIVE, updated_at ile ile,
rem   root@system.com ACTIVE, boot bila "Activating ROOT user: admin@admin.com" -^> Flyway (idadi + toleo) kabla = baada -^> prod ps
rem   kabla = baada. Script: analysis\steps\57c-staging-2272.sh.
rem Lazima kwanza: 57b ---OK---. Matokeo: analysis\steps\57c-staging-2272.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\57c-staging-2272.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-57c--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\57b-staging-env.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 57b haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 57b haikuisha na ---OK---. Soma analysis\steps\57b-staging-env.log. 57c haijaendeshwa.
  goto end
)
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\hali-root.sh contabo:/tmp/hali-root.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\57c-staging-2272.sh contabo:/tmp/57c-staging-2272.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=SERVER-57c
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/57c-staging-2272.sh; R=$?; rm -f /tmp/57c-staging-2272.sh; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\57c-staging-2272.log" ---57C_SERVER_MWISHO---
if not defined NIMEPATA (
  echo SIYO: log ya server haina ---57C_SERVER_MWISHO--- >> %L%
  set RC=1
  goto fail
)
for %%w in (NI_STAGING DIGEST_PULL_SAWA DIGEST_INAYOENDESHA_SAWA BAADA_ROOT_SYSTEM_ACTIVE ADMIN_ROOT_BAADA_SAWA FLYWAY_HAIJABADILIKA PROD_HAIJAGUSWA) do (
  set "NIMEPATA="
  call :mstari_pekee "analysis\steps\57c-staging-2272.log" %%w
  if not defined NIMEPATA (
    echo SIYO: log ya server haina %%w >> %L%
    set RC=1
    goto fail
  )
)
echo ---VICHUJIO-VIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/hali-root.sh /tmp/hali-root-staging.kabla && echo vichujio vimefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - staging inaendesha 2.2.72 (digest ya 57a); admin@admin.com bado INACTIVE; root@system.com ACTIVE; Flyway haikubadilika. Sasa unaweza kuendesha 57d. Matokeo: %L%.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/hali-root.sh /tmp/57c-staging-2272.sh" >> %L% 2>&1
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
