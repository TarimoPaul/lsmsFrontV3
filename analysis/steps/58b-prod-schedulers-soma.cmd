@echo off
rem HATUA 58b - KUSOMA TU (mmiliki 28/10 aa): je, schedulers za prod zinaendeshwa? Hakuna journal ya SCHEDULER tangu 05/10 00:10.
rem   IENDESHE 29/10/2026 BAADA YA 00:15 EAT (ili log iwe na kazi ya 00:05 na 00:10 ya leo).
rem   Server (analysis\steps8b-schedulers-soma.sh + .sql): container ya backend ilipoanza; env; app.schedulers.enabled na
rem   spring.profiles.group.prod kama zilivyo NDANI ya jar (funguo hizo mbili tu); log tangu container ilipoanza - mistari ya
rem   [Scheduler] / CapitalExpenditureScheduler / depreciation / recurring; hitimisho SCHEDULERS_ZINAENDESHA / HAZIENDESHI /
rem   HAIJULIKANI; SQL ya kusoma tu: journal za SCHEDULER, templates, watoto wa 00:05, capex bila journal, depreciation, makosa.
rem Hakuna restart, hakuna kuandika, config haibadilishwi, hakuna password. Matokeo: analysis\steps8b-prod-schedulers-soma.log
rem Kila output ya Contabo inapita ficha.awk kwenye server. Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\58b-prod-schedulers-soma.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-58b--- > %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\58b-schedulers-soma.sh contabo:/tmp/58b-schedulers-soma.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\58b-schedulers-soma.sql contabo:/tmp/58b-schedulers-soma.sql >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=USHAHIDI-KUSOMA-TU
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/58b-schedulers-soma.sh; R=$?; rm -f /tmp/58b-schedulers-soma.sh /tmp/58b-schedulers-soma.sql; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\58b-prod-schedulers-soma.log" ---USHAHIDI_58B_UMEKAMILIKA---
if not defined NIMEPATA (
  echo SIYO: script ya server haikumaliza >> %L%
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - 58b imekamilika. Matokeo: %L%. Nitumie log hii.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/58b-schedulers-soma.sh /tmp/58b-schedulers-soma.sql" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Hakuna kilichobadilishwa. Nitumie log.
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
