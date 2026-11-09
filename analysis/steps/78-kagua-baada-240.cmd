@echo off
rem HATUA 78 (mmiliki 09/11 dl) - PROD, KUSOMA TU, asubuhi 10/11: gl_posting_failure, LOANINT 10/11, Muhtasari wa Mauzo, login_audit 24h, ERROR za backend.
rem   Output inapita ficha.awk kabla ya kutoka server. Matokeo: analysis\steps\78-kagua-baada-240.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\78-kagua-baada-240.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-78--- > %L%
echo %date% %time% >> %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\78-kagua-baada-240.sh contabo:/tmp/ >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=KAGUA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/78-kagua-baada-240.sh; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/78-kagua-baada-240.sh && echo faili za /tmp zimefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - matokeo: %L%. Nitumie log.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/78-kagua-baada-240.sh" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Nitumie log.
:end
endlocal
