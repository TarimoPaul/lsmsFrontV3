@echo off
rem HATUA 66 - KUSOMA TU, PROD (mmiliki 02/11 bz). Inaweza kuendeshwa wakati wowote: haiandiki, haifanyi restart.
rem   Server (analysis\steps\66-kagua-1200.sh + .sql), psql ya kusoma tu (default_transaction_read_only, timeout dk 2):
rem   GL 1200 dhidi ya daftari la stock (stock x current_average_cost) leo, na daraja la tofauti:
rem   mwendo wa stock bila journal (aina, mwezi, tangu true-up), stock ya mwanzo na mapengo ya mnyororo, manunuzi bila journal,
rem   GL isiyo na bidhaa (true-up, journal za mkono), bidhaa kumi kubwa, avg dhidi ya last cost, na thamani ya
rem   "Stock value" ya ripoti ya uendeshaji (DailyPnlService.stockValueAt: bei ya manunuzi ya mwisho).
rem Hakuna password. Matokeo: analysis\steps\66-kagua-1200.log. Kila output ya Contabo inapita ficha.awk kwenye server.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\66-kagua-1200.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-66--- > %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\66-kagua-1200.sh contabo:/tmp/66-kagua-1200.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\66-kagua-1200.sql contabo:/tmp/66-kagua-1200.sql >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=KUSOMA-TU
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/66-kagua-1200.sh; R=$?; rm -f /tmp/66-kagua-1200.sh /tmp/66-kagua-1200.sql; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\66-kagua-1200.log" ---USHAHIDI_66_UMEKAMILIKA---
if not defined NIMEPATA (
  echo SIYO: script ya server haikumaliza >> %L%
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - 66 imekamilika. Matokeo: %L%. Nitumie log hii.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/66-kagua-1200.sh /tmp/66-kagua-1200.sql" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Hakuna kilichobadilishwa. Nitumie log.
:end
endlocal
goto :eof
rem :mstari_pekee "<faili>" <neno> - NIMEPATA=1 ikiwa mstari fulani wa <faili> una <neno> PEKE YAKE, bila kujali
rem nafasi, tab au 
 (CRLF, LF, au bila mwisho wa mstari). Inachukua nafasi ya findstr /x, ambayo haioni mstari
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
rem (bila kujali nafasi, tab au 
). Faili lisilokuwepo = HAPANA.
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
