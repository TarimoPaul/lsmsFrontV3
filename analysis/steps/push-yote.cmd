@echo off
rem PUSH-YOTE (mmiliki 01/11 bn; 03/11 cm + tawi 4) - matawi 5 kwenda origin, BILA force, kwa mpangilio:
rem   1. backend  lsmsBackend  release/2.4.0
rem   2. V3       lsmsFrontV3  release/3.2.0
rem   3. V3       lsmsFrontV3  main
rem   4. backend  lsmsBackend  feature/c2-null-params (C2, jipya kwenye origin mara ya kwanza)
rem   5. backend  lsmsBackend  main (09/11 cz: main = 2.4.0 + .backend-version; image zinajengwa kutoka main)
rem   Hatua ya 1 (KAGUA, haibadilishi kitu): git fetch, hash ya local na ya origin, na kama push ni fast-forward tu.
rem     origin ina commit ambazo local haina (si fast-forward) = KATAA tawi hilo na hakuna push hata moja.
rem   Kituo: andika  push  kuendelea; kingine chochote = simama bila kupush.
rem   Hatua ya 2: git push origin tawi:tawi (bila --force, bila tags), kisha hash ya origin lazima ilingane na local.
rem   Tags hazipushwi hapa. Matokeo: analysis\steps\push-yote.log
setlocal EnableDelayedExpansion
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\push-yote.log
set "BE=D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms"
set "V3=D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-PUSH-YOTE--- > %L%
echo saa %DATE% %TIME% >> %L%
set KOSA=0
set KAZI=0

echo ---KAGUA--- >> %L%
call :kagua "%BE%" release/2.4.0 1
call :kagua "%V3%" release/3.2.0 2
call :kagua "%V3%" main 3
call :kagua "%BE%" feature/c2-null-params 4
call :kagua "%BE%" main 5
if not "%KOSA%"=="0" (
  echo ---IMEKATALIWA: tawi %KOSA_LA% halipushiki bila force - hakuna kilichopushwa--- >> %L%
  echo IMEKATALIWA - soma %L%. Hakuna kilichopushwa.
  goto end
)
if "%KAZI%"=="0" (
  echo ---HAKUNA-CHA-KUPUSH: origin iko sawa na local kwa matawi yote--- >> %L%
  echo ---OK--- >> %L%
  echo Hakuna cha kupush - matawi yote 5 yako sawa na origin. Matokeo: %L%
  goto end
)
type %L%
echo.
set "JIBU="
set /p JIBU=Andika push kupush matawi %KAZI% juu kwenda origin - kingine chochote = simama:
if /i not "%JIBU%"=="push" (
  echo ---IMESIMAMISHWA-NA-MMILIKI: hakuna kilichopushwa--- >> %L%
  echo IMESIMAMISHWA - hakuna kilichopushwa.
  goto end
)
echo mmiliki ameandika: push >> %L%

echo ---PUSH--- >> %L%
call :push "%BE%" release/2.4.0 1
if not "%KOSA%"=="0" goto fail
call :push "%V3%" release/3.2.0 2
if not "%KOSA%"=="0" goto fail
call :push "%V3%" main 3
if not "%KOSA%"=="0" goto fail
call :push "%BE%" feature/c2-null-params 4
if not "%KOSA%"=="0" goto fail
call :push "%BE%" main 5
if not "%KOSA%"=="0" goto fail
echo ---OK--- >> %L%
echo OK - push imekamilika. Matokeo: %L%. Nitumie log hii.
goto end

:fail
echo ---IMESHINDWA-KWENYE: PUSH tawi %KOSA_LA%--- >> %L%
echo IMESHINDWA kwenye tawi %KOSA_LA% - soma %L%. Matawi yaliyotangulia (kama yapo) yamepushwa; yanayofuata hayajapushwa.
goto end

rem :kagua "<repo>" <tawi> <namba> - fetch, LOCAL/ORIGIN hash, FF au KATAA. Inaweka HALI_<namba> = MPYA / TAYARI / FF.
:kagua
set "R=%~1"
set "B=%~2"
set "LH="
set "RH="
for /f "usebackq delims=" %%h in (`git -C "%R%" rev-parse --verify --quiet refs/heads/%B%`) do set "LH=%%h"
if not defined LH (
  echo TAWI_%~3 %B% SIYO: halipo local kwenye %R% >> %L%
  set KOSA=%~3
  set "KOSA_LA=%B%"
  goto :eof
)
git -C "%R%" fetch --quiet origin >> %L% 2>&1
for /f "usebackq tokens=1" %%h in (`git -C "%R%" ls-remote origin refs/heads/%B%`) do set "RH=%%h"
if not defined RH (
  echo TAWI_%~3 %B% local !LH! origin HAKUNA - litaundwa MPYA >> %L%
  set "HALI_%~3=MPYA"
  set /a KAZI+=1
  goto :eof
)
if "!RH!"=="!LH!" (
  echo TAWI_%~3 %B% local !LH! origin !RH! - TAYARI, hakuna cha kupush >> %L%
  set "HALI_%~3=TAYARI"
  goto :eof
)
git -C "%R%" merge-base --is-ancestor !RH! !LH! >nul 2>&1
if errorlevel 1 (
  echo TAWI_%~3 %B% local !LH! origin !RH! - SIYO FAST-FORWARD: origin ina commit ambazo local haina >> %L%
  set KOSA=%~3
  set "KOSA_LA=%B%"
  goto :eof
)
for /f "usebackq delims=" %%n in (`git -C "%R%" rev-list --count !RH!..!LH!`) do set "N=%%n"
echo TAWI_%~3 %B% local !LH! origin !RH! - FF, commit !N! mpya >> %L%
set "HALI_%~3=FF"
set /a KAZI+=1
goto :eof

rem :push "<repo>" <tawi> <namba> - push bila force kama HALI ni MPYA/FF, kisha origin lazima = local.
:push
set "R=%~1"
set "B=%~2"
if "!HALI_%~3!"=="TAYARI" (
  echo PUSH_%~3 %B% - TAYARI, imerukwa >> %L%
  goto :eof
)
set "LH="
set "RH="
for /f "usebackq delims=" %%h in (`git -C "%R%" rev-parse --verify --quiet refs/heads/%B%`) do set "LH=%%h"
git -C "%R%" push origin refs/heads/%B%:refs/heads/%B% >> %L% 2>&1
set RC=!errorlevel!
for /f "usebackq tokens=1" %%h in (`git -C "%R%" ls-remote origin refs/heads/%B%`) do set "RH=%%h"
if not "!RC!"=="0" (
  echo PUSH_%~3 %B% SIYO: git push exit !RC! >> %L%
  set KOSA=%~3
  set "KOSA_LA=%B%"
  goto :eof
)
if not "!RH!"=="!LH!" (
  echo PUSH_%~3 %B% SIYO: baada ya push origin !RH! si sawa na local !LH! >> %L%
  set KOSA=%~3
  set "KOSA_LA=%B%"
  goto :eof
)
echo PUSH_%~3 %B% SAWA origin = local = !LH! >> %L%
goto :eof

:end
endlocal
