@echo off
rem HATUA 77 (mmiliki 09/11 di) - Contabo, KUSOMA TU: dump 09/11 + 08/11 zinasomwa kwa stdin sahihi; DB ya staging haijaguswa.
rem   Output inapita ficha.awk kabla ya kutoka server. Matokeo: analysis\steps\77-kagua-dump.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\77-kagua-dump.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-77--- > %L%
echo %date% %time% >> %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\77-kagua-dump.sh contabo:/tmp/ >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=KAGUA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/77-kagua-dump.sh; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/77-kagua-dump.sh && echo faili za /tmp zimefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - matokeo: %L%. Nitumie log.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/77-kagua-dump.sh" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Nitumie log.
:end
endlocal
