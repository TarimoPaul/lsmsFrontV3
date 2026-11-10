@echo off
rem HATUA 84 (mmiliki 10/11 el/em) - PROD, KUSOMA TU: (A) maelezo ya journal ya 83 ni sahihi au mojibake (hex); (B) bidhaa za kupima na wazazi wao kwenye store.

rem   PG kwa default_transaction_read_only=on. Output inapita ficha.awk. Matokeo: analysis\steps\84-kagua-kupima.log

setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\84-kagua-kupima.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-84--- > %L%
echo %date% %time% >> %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\84-kagua-kupima.sh contabo:/tmp/ >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=KAGUA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/84-kagua-kupima.sh; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/84-kagua-kupima.sh && echo faili za /tmp zimefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - matokeo: %L%. Nitumie log.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/84-kagua-kupima.sh" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Nitumie log.
:end
endlocal
