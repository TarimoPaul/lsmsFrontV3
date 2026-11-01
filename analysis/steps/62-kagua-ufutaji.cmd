@echo off
rem HATUA 62 - KUSOMA TU, PROD (mmiliki 01/11 bk). Inaweza kuendeshwa wakati wowote: haiandiki, haifanyi restart.
rem   Server (analysis\steps\62-kagua-ufutaji.sh + .sql), psql ya kusoma tu (default_transaction_read_only, timeout dk 2):
rem   a) sale 311026-2139: ilifutwa lini/na nani, journal na reversal zake (entry_date dhidi ya event_date), kipindi cha
rem      Okt/Nov, reco ya siku ya sale na ya 31/10, kumbukumbu za reco tangu 31/10, sale mpya mahali pake;
rem   b) reco za Oktoba: variance ya kila reco, zinazojirudia, na kiasi cha ~12,587 / ~31,634 popote kwenye reco na journal;
rem   c) gl_posting_failure tangu 31/10 18:00;  d) depreciation ya 31/10.
rem Hakuna password. Matokeo: analysis\steps\62-kagua-ufutaji.log. Kila output ya Contabo inapita ficha.awk kwenye server.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\62-kagua-ufutaji.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-62--- > %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\62-kagua-ufutaji.sh contabo:/tmp/62-kagua-ufutaji.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\62-kagua-ufutaji.sql contabo:/tmp/62-kagua-ufutaji.sql >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=KUSOMA-TU
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/62-kagua-ufutaji.sh; R=$?; rm -f /tmp/62-kagua-ufutaji.sh /tmp/62-kagua-ufutaji.sql; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\62-kagua-ufutaji.log" ---USHAHIDI_62_UMEKAMILIKA---
if not defined NIMEPATA (
  echo SIYO: script ya server haikumaliza >> %L%
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - 62 imekamilika. Matokeo: %L%. Nitumie log hii.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/62-kagua-ufutaji.sh /tmp/62-kagua-ufutaji.sql" >> %L% 2>&1
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
