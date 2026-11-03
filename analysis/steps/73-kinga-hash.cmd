@echo off
rem HATUA 73 - KINGA YA SIRI ZA MAJARIBIO (mmiliki 03/11 cp), PROD, KUSOMA TU. Hakuna kinachobadilika kwenye server.
rem   Inasoma ~/lsms-deployment/.env KWENYE server na kurudisha hash tu (sha256 ya "lsms-kinga-v1:" + thamani) za kila
rem   siri (jina lenye PASS/SECRET/TOKEN/KEY). Hash zinaandikwa %USERPROFILE%\.lsms-kinga\prod-siri.sha256 (NJE ya git).
rem   Log ina majina ya siri na idadi tu - HAINA hash wala thamani. pg-checks.sh / c2-check.sh za backend zinakataa
rem   kuendesha bila faili hilo, au siri yao ya majaribio ikilingana na hash yoyote humo.
rem Server: 73-kinga-hash.sh (+ ficha.awk). Matokeo: analysis\steps\73-kinga-hash.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\73-kinga-hash.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set "W=%TEMP%\lsms-73"
set "KD=%USERPROFILE%\.lsms-kinga"
set "HF=%USERPROFILE%\.lsms-kinga\prod-siri.sha256"
set STEP=
set RC=
set "N="
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-73--- > %L%
echo %date% %time% >> %L%
if exist "%W%" rd /s /q "%W%"
mkdir "%W%"
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\73-kinga-hash.sh contabo:/tmp/ >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=HASH
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/73-kinga-hash.sh; } 2>&1 | awk %F%" > "%W%\h.txt" 2>&1
set RC=%errorlevel%
rem log: majina na idadi tu (tokens 1-2), hash HAIENDI kwenye log
for /f "usebackq tokens=1,2" %%a in ("%W%\h.txt") do echo %%a %%b>> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "%W%\h.txt" ---73_SERVER_MWISHO---
if not defined NIMEPATA (
  set STEP=ISHARA-73_SERVER_MWISHO
  set RC=1
  goto fail
)
for /f "usebackq tokens=1,2" %%a in ("%W%\h.txt") do if "%%a"=="HASH_IDADI" set "N=%%b"
if not defined N (
  set STEP=HASH_IDADI-HAIPO
  set RC=1
  goto fail
)
if "%N%"=="0" (
  set STEP=HAKUNA-SIRI-KWENYE-ENV
  set RC=1
  goto fail
)
if not exist "%KD%" mkdir "%KD%"
findstr /b /c:"HASH " "%W%\h.txt" > "%W%\hash.txt"
copy /y "%W%\hash.txt" "%HF%" > nul
set RC=%errorlevel%
if not "%RC%"=="0" (
  set STEP=KUANDIKA-FAILI-LA-HASH
  goto fail
)
echo HASH_FAILI %HF% >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/73-kinga-hash.sh && echo faili za /tmp zimefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - hash %N% zimeandikwa %HF%. Matokeo: %L%. Nitumie log.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/73-kinga-hash.sh" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Nitumie log.
:end
if exist "%W%" rd /s /q "%W%"
endlocal
goto :eof
rem :mstari_pekee "<faili>" <neno> - NIMEPATA=1 ikiwa mstari fulani una <neno> PEKE YAKE (bila kujali nafasi/CR) - kama 71f
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
