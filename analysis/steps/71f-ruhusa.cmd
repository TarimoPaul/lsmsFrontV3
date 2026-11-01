@echo off
rem HATUA 71f - A4 ZIADA, PROD (mmiliki 29/10 ax): ondoa PRINT_JOB_MANAGE kwenye role zote na futa role "printer" (soft delete
rem   kama Role.delete() ya app). Data tu: role_permissions + roles. Backend haiguswi (ruhusa zinasomwa upya ndani ya dak 15).
rem   Kinga: log ya 71e lazima iishie ---OK--- (akaunti imezimwa, kazi PRINTING zimeshughulikiwa), vinginevyo hakuna ssh.
rem   1) KUSOMA TU: nakala KAMILI ya role_permissions (RP_NAKALA = rollback), dryRun (MANAGE_KUONDOLEWA), role zenye MANAGE
rem      bila CREATE (zingepoteza GET /api/v1/print-jobs/{uid}), masharti ya 71e   2) KITUO: SAFISHA   3) transaction moja
rem Server: 71f-ruhusa.sh + 71f-soma.sql + 71f-badilisha.sql. Matokeo: analysis\steps\71f-ruhusa.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\71f-ruhusa.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set "W=%TEMP%\lsms-71f"
set STEP=
set RC=
set "N="
set "JIBU="
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-71f--- > %L%
echo %date% %time% >> %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\71e-printagent.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya 71e haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: endesha 71e kwanza hadi ---OK---.
  goto end
)
if exist "%W%" rd /s /q "%W%"
mkdir "%W%"
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\71f-ruhusa.sh analysis\steps\71f-soma.sql analysis\steps\71f-badilisha.sql contabo:/tmp/ >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=SOMA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/71f-ruhusa.sh soma; } 2>&1 | awk %F%" > "%W%\soma.txt" 2>&1
set RC=%errorlevel%
type "%W%\soma.txt" >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "%W%\soma.txt" ---71f_SERVER_MWISHO---
if not defined NIMEPATA (
  set STEP=ISHARA-71f_SERVER_MWISHO
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "%W%\soma.txt" PA_IMEZIMWA
if not defined NIMEPATA (
  echo ---IMEKATALIWA: akaunti ya print-agent HAIJAZIMWA - 71e kwanza--- >> %L%
  echo IMEKATALIWA: akaunti ya print-agent bado haijazimwa. Endesha 71e kwanza.
  goto safisha_server
)
for /f "usebackq tokens=1,2" %%a in ("%W%\soma.txt") do if "%%a"=="MANAGE_IDADI" set "N=%%b"
set "NIMEPATA="
call :ishara "%W%\soma.txt" PJ_PRINTING_IDADI_0
if not defined NIMEPATA (
  set STEP=BADO-KUNA-KAZI-PRINTING-71e-KWANZA
  set RC=1
  goto fail
)
findstr /b /c:"MANAGE_BILA_CREATE|-" "%W%\soma.txt" > nul
if errorlevel 1 (
  set STEP=KUNA-ROLE-YENYE-MANAGE-BILA-CREATE
  set RC=1
  goto fail
)

if not defined N (
  set STEP=MANAGE_IDADI-HAIPO
  set RC=1
  goto fail
)
if "%N%"=="0" (
  echo TAYARI: hakuna role yenye PRINT_JOB_MANAGE >> %L%
  echo ---OK--- >> %L%
  echo OK - hakuna cha kubadilisha. Matokeo: %L%. Nitumie log.
  goto safisha_server
)
echo.
findstr /b "RP_JUMLA MANAGE_ ROLE_PRINTER CREATE_ROLES PA_ PJ_" "%W%\soma.txt"
echo.
echo ======================== KITUO (STOP) ========================
echo PRINT_JOB_MANAGE itaondolewa kwenye role %N% - orodha hapo juu - na role printer itafutwa, soft delete.
echo Nakala kamili ya role_permissions iko kwenye log - RP_NAKALA. Role zote zinabaki na PRINT_JOB_CREATE.
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
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/71f-ruhusa.sh badilisha %N%; } 2>&1 | awk %F%" > "%W%\b.txt" 2>&1
set RC=%errorlevel%
type "%W%\b.txt" >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
for %%w in (MANAGE_BAADA_0 ROLE_PRINTER_HAI_BAADA_0) do (
  set "NIMEPATA="
  call :ishara "%W%\b.txt" %%w
  if not defined NIMEPATA (
    set STEP=ISHARA-%%w
    set RC=1
    goto fail
  )
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/71f-ruhusa.sh /tmp/71f-soma.sql /tmp/71f-badilisha.sql && echo faili za /tmp zimefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - PRINT_JOB_MANAGE imeondolewa kwenye role %N%, role printer imefutwa. Matokeo: %L%. Nitumie log.
goto end
:safisha_server
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/71f-ruhusa.sh /tmp/71f-soma.sql /tmp/71f-badilisha.sql" >> %L% 2>&1
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/71f-ruhusa.sh /tmp/71f-soma.sql /tmp/71f-badilisha.sql" >> %L% 2>&1
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
rem :mwisho_ni "<faili>" <neno> - NIMEPATA=1 ikiwa mstari wa MWISHO usio tupu ni <neno> PEKE YAKE. Faili lisilokuwepo = HAPANA.
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
