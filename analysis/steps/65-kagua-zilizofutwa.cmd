@echo off
rem HATUA 65 - KUSOMA TU, PROD (mmiliki 02/11 bv). Inaweza kuendeshwa wakati wowote: haiandiki, haifanyi restart.
rem   Server (analysis\steps\65-kagua-zilizofutwa.sh + .sql), psql ya kusoma tu (default_transaction_read_only, timeout dk 2):
rem   sale 6 zilizofutwa tangu 30/10 (301026-2245/2251/2253, 311026-0831, 311026-2139, 011126-0720) na nyingine yoyote
rem   iliyofutwa tangu 30/10: nani/lini/sababu, bidhaa (kiasi, stock iliyorudishwa), sale mbadala (iliingizwa upya?),
rem   na hesabu 2 za kwanza za kila bidhaa baada yake (tofauti, tozo 1120, stock_adjustment).
rem Hakuna password. Matokeo: analysis\steps\65-kagua-zilizofutwa.log. Kila output ya Contabo inapita ficha.awk kwenye server.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\65-kagua-zilizofutwa.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-65--- > %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\65-kagua-zilizofutwa.sh contabo:/tmp/65-kagua-zilizofutwa.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\65-kagua-zilizofutwa.sql contabo:/tmp/65-kagua-zilizofutwa.sql >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=KUSOMA-TU
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/65-kagua-zilizofutwa.sh; R=$?; rm -f /tmp/65-kagua-zilizofutwa.sh /tmp/65-kagua-zilizofutwa.sql; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\65-kagua-zilizofutwa.log" ---USHAHIDI_65_UMEKAMILIKA---
if not defined NIMEPATA (
  echo SIYO: script ya server haikumaliza >> %L%
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - 65 imekamilika. Matokeo: %L%. Nitumie log hii.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/65-kagua-zilizofutwa.sh /tmp/65-kagua-zilizofutwa.sql" >> %L% 2>&1
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
