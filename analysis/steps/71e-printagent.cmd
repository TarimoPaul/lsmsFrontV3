@echo off
rem HATUA 71e - A4 PRINT-AGENT, PROD (mmiliki 29/10 aw). Inabadilisha print_jobs TU, baada ya KITUO. Backend haiguswi.
rem   1) KUSOMA TU: (a) akaunti ya print-agent d89760f8-... imezimwa? (lazima PA_IMEZIMWA - izime kwanza kupitia V3 Users)
rem      (b) dryRun: kazi PRINTING za kabla ya 01/07 + nakala ya kila safu (PJ_SAFU = rollback)  (c) role printer (orodha tu)
rem   2) KITUO: SAFISHA -> 3) transaction moja: PRINTING -> FAILED (sababu kwenye error_message), ikiwa idadi = ya dryRun
rem Server: 71e-printagent.sh + 71e-soma.sql + 71e-badilisha.sql. Matokeo: analysis\steps\71e-printagent.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\71e-printagent.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set "W=%TEMP%\lsms-71e"
set STEP=
set RC=
set "N="
set "JIBU="
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-71e--- > %L%
echo %date% %time% >> %L%
if exist "%W%" rd /s /q "%W%"
mkdir "%W%"
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\71e-printagent.sh analysis\steps\71e-soma.sql analysis\steps\71e-badilisha.sql contabo:/tmp/ >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=SOMA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/71e-printagent.sh soma; } 2>&1 | awk %F%" > "%W%\soma.txt" 2>&1
set RC=%errorlevel%
type "%W%\soma.txt" >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "%W%\soma.txt" ---71e_SERVER_MWISHO---
if not defined NIMEPATA (
  set STEP=ISHARA-71e_SERVER_MWISHO
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "%W%\soma.txt" PA_IMEZIMWA
if not defined NIMEPATA (
  echo ---IMEKATALIWA: akaunti ya print-agent HAIJAZIMWA - izime kupitia V3 Users, kisha endesha 71e tena--- >> %L%
  echo IMEKATALIWA: akaunti ya print-agent bado haijazimwa. Izime kupitia V3 Users, kisha endesha 71e tena.
  goto safisha_server
)
for /f "usebackq tokens=1,2" %%a in ("%W%\soma.txt") do if "%%a"=="PJ_PRINTING_KABLA_YA_JULAI" set "N=%%b"
if not defined N (
  set STEP=PJ_PRINTING_KABLA_YA_JULAI-HAIPO
  set RC=1
  goto fail
)
if "%N%"=="0" (
  echo TAYARI: hakuna kazi PRINTING za kabla ya Julai >> %L%
  echo ---OK--- >> %L%
  echo OK - akaunti imezimwa na hakuna kazi za kubadilisha. Matokeo: %L%. Nitumie log.
  goto safisha_server
)
echo.
findstr /b "PA_HALI PJ_PRINTING PJ_DRYRUN ROLE_PRINTER PRINT_JOB_MANAGE_ROLES" "%W%\soma.txt"
echo.
echo ======================== KITUO (STOP) ========================
echo Akaunti ya print-agent IMEZIMWA. Kazi %N% za PRINTING (kabla ya 01/07) zitakuwa FAILED, na sababu kwenye error_message.
echo Nakala ya kila safu iko kwenye log (PJ_SAFU). Role printer haiguswi (orodha tu).
echo Andika SAFISHA kisha Enter ili kubadilisha. Kitu kingine chochote = simama.
echo ===============================================================
set /p "JIBU=Jibu: "
if not "%JIBU%"=="SAFISHA" (
  echo ---IMESIMAMA-KWA-MMILIKI: hakuna kilichobadilika--- >> %L%
  echo Umesimama. Hakuna kilichobadilika.
  goto safisha_server
)
echo ---MMILIKI-AMEANDIKA-SAFISHA %date% %time%--- >> %L%
set STEP=BADILISHA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/71e-printagent.sh badilisha %N%; } 2>&1 | awk %F%" > "%W%\b.txt" 2>&1
set RC=%errorlevel%
type "%W%\b.txt" >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
for %%w in (PJ_IMEBADILISHWA_%N% PJ_PRINTING_BAADA_0) do (
  set "NIMEPATA="
  call :ishara "%W%\b.txt" %%w
  if not defined NIMEPATA (
    set STEP=ISHARA-%%w
    set RC=1
    goto fail
  )
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/71e-printagent.sh /tmp/71e-soma.sql /tmp/71e-badilisha.sql && echo faili za /tmp zimefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - kazi %N% za print_jobs sasa ni FAILED; akaunti imezimwa. Matokeo: %L%. Nitumie log.
goto end
:safisha_server
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/71e-printagent.sh /tmp/71e-soma.sql /tmp/71e-badilisha.sql" >> %L% 2>&1
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/71e-printagent.sh /tmp/71e-soma.sql /tmp/71e-badilisha.sql" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Nitumie log.
:end
if exist "%W%" rd /s /q "%W%"
set "JIBU="
endlocal
goto :eof
rem :ishara "<faili>" <NENO_NAMBA> - kama :mstari_pekee, lakini "PJ_IMEBADILISHWA_19" inalingana na mstari "PJ_IMEBADILISHWA 19"
:ishara
setlocal EnableDelayedExpansion
set "CR="
for /f %%a in ('copy /Z "%~f0" nul') do set "CR=%%a"
set "P="
for /f "usebackq tokens=1,2,3" %%A in ("%~1") do (
  set "A=%%A_%%B" & set "C=%%C."
  for %%r in ("!CR!") do (set "A=!A:%%~r=!" & set "C=!C:%%~r=!")
  if "!A!"=="%~2" if "!C!"=="." set "P=1"
)
endlocal & set "NIMEPATA=%P%"
goto :eof
rem :mstari_pekee "<faili>" <neno> - NIMEPATA=1 ikiwa mstari fulani una <neno> PEKE YAKE (bila kujali nafasi/CR)
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
