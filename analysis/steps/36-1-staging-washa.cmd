@echo off
rem HATUA 36-1 - KUWASHA STAGING (mmiliki aliisimamisha mwenyewe 19/10, si OOM). INABADILISHA STAGING TU: containers zake zinawashwa.
rem HAIBADILISHI image wala tag: .env lazima iwe BACKEND_VERSION=2.2.70; images zote lazima ziwe tayari kwenye server;
rem `docker compose -p lsms-staging up -d --pull never` (hakuna pull). Prod (~/lsms-deployment) inasomwa tu, kabla na baada.
rem Inasubiri: postgres healthy (hadi sek 180) na backend ijibu kupitia nginx ya staging 127.0.0.1:8081 (hadi sek 300).
rem Inathibitisha: backend inayoendesha = 2.2.70 na Flyway = 133 (kusoma tu).
rem RAM/disk kabla na baada; prod ps kabla na baada (lazima zifanane).
rem Mantiki iko kwenye 36-1-staging-washa.sh (inaendeshwa kwenye Contabo); kila mstari unapita kwenye ficha.awk.
rem Matokeo: analysis\steps\36-1-staging-washa.log -> ---OK--- au ---IMESHINDWA-KWENYE: <sehemu> (exit N)---
rem Ikipita: endesha 36-0-staging-db.cmd (inapaswa kuisha ---OK---), kisha 36.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\36-1-staging-washa.log
set STEP=
echo ---MWENDESHO-36-1--- > %L%

set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
scp analysis\steps\36-1-staging-washa.sh contabo:/tmp/36-1-staging-washa.sh >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail

set STEP=ENDESHA-KWENYE-CONTABO
echo ---%STEP%--- >> %L%
ssh contabo "set -o pipefail; bash /tmp/36-1-staging-washa.sh 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%

echo ---FAILI-ZA-MUDA-ZINAFUTWA--- >> %L%
ssh contabo "rm -f /tmp/36-1-staging-washa.sh /tmp/ficha-lsms.awk && echo zimefutwa" >> %L% 2>&1
if not "%RC%"=="0" goto failsh
set "NIMEPATA="
call :mstari_pekee "%L%" ---OK---
if not defined NIMEPATA goto failsh
echo OK. Staging imewashwa (2.2.70 / 133). Matokeo: %L%. Sasa endesha 36-0-staging-db.cmd, kisha 36.
goto end

:failsh
rem Script ya server imeshaandika ---IMESHINDWA-KWENYE: <sehemu> (exit N)--- yenyewe (isipokuwa ssh ilikatika).
findstr /b /l /c:"---IMESHINDWA-KWENYE:" %L% > nul
if errorlevel 1 echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
echo IMESHINDWA - soma %L%
goto end
:fail
ssh contabo "rm -f /tmp/36-1-staging-washa.sh /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%
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
