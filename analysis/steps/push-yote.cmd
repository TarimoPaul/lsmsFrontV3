@echo off
rem PUSH-YOTE (mmiliki 01/11 bn; 03/11 cm + tawi 4) - matawi 5 kwenda origin, BILA force, kwa mpangilio:
rem   1-2. (13/11 gp 6) release/2.4.0 na release/3.2.0 ZIMEFUTWA local - haziko tena hapa (tag v2.4.0 / v3.2.0 zinabaki).
rem   (13/11 gu) KINGA YA SIRI kabla ya push: analysis\steps\94-kagua-siri.py kwenye commit zote ambazo hazijapushwa -
rem        V3 (analysis/) na backend (repo nzima). Isiposema KAGUA_SIRI_SAFI = KATAA, hakuna kilichopushwa.
rem   3. V3       lsmsFrontV3  main
rem   4. backend  lsmsBackend  feature/c2-null-params (C2, jipya kwenye origin mara ya kwanza)
rem   5. backend  lsmsBackend  main (09/11 cz: main = 2.4.0 + .backend-version; image zinajengwa kutoka main)
rem   Tag (09/11 dm): 6. backend v2.4.0  7. V3 v3.2.0 - annotated; tag ikiwa tayari origin kwa hash TOFAUTI = KATAA (hakuna force).
rem   (13/11 hi 1) 8. backend v2.5.0 (a86fbcf)  9. V3 v3.3.0 (a1caafc) - prod tangu 13/11 14:05; sheria ileile.
rem   10+. (09/11 dv) MATAWI YA TOLEO 2 - yanaongezwa KIOTOMATIKI: kila tawi la local linaloitwa feature/t2-*
rem       kwenye backend NA V3 (k.m. feature/t2-gharama). Tawi jipya la toleo 2 = liite feature/t2-<jina>,
rem       hakuna haja ya kubadilisha faili hili. Sheria ni zile zile: fast-forward tu, bila force.
rem   Majaribio: set PUSH_YOTE_LOG=<faili> ili log iende mahali pengine.
rem   Hatua ya 1 (KAGUA, haibadilishi kitu): git fetch, hash ya local na ya origin, na kama push ni fast-forward tu.
rem     origin ina commit ambazo local haina (si fast-forward) = KATAA tawi hilo na hakuna push hata moja.
rem   Kituo: andika  push  kuendelea; kingine chochote = simama bila kupush.
rem   Hatua ya 2: git push origin tawi:tawi (bila --force, bila tags), kisha hash ya origin lazima ilingane na local.
rem   Tags hazipushwi hapa. Matokeo: analysis\steps\push-yote.log
setlocal EnableDelayedExpansion
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\push-yote.log
if defined PUSH_YOTE_LOG set "L=%PUSH_YOTE_LOG%"
set "BE=D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms"
set "V3=D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-PUSH-YOTE--- > %L%
echo saa %DATE% %TIME% >> %L%
set KOSA=0
set KAZI=0
set IDADI=9

echo ---KAGUA--- >> %L%
call :kagua "%V3%" main 3
call :kagua "%BE%" feature/c2-null-params 4
call :kagua "%BE%" main 5
call :kagua_tag "%BE%" v2.4.0 6
call :kagua_tag "%V3%" v3.2.0 7
call :kagua_tag "%BE%" v2.5.0 8
call :kagua_tag "%V3%" v3.3.0 9
rem 10+: matawi ya toleo 2 (feature/t2-*) yanagunduliwa kiotomatiki
call :gundua "%BE%"
call :gundua "%V3%"
set /a T2=IDADI-9
echo MATAWI_YA_TOLEO_2 feature/t2-*: %T2% yamegunduliwa >> %L%
echo ---KINGA-YA-SIRI--- >> %L%
python analysis\steps\94-kagua-siri.py "%V3%" origin/main analysis > "%TEMP%\push-yote-94.txt" 2>&1
set RC94=%errorlevel%
findstr /b "KINGA_73 COMMIT IMEPATA KAGUA_SIRI" "%TEMP%\push-yote-94.txt" >> %L%
if not "%RC94%"=="0" (
  set KOSA=1
  set "KOSA_LA=kinga ya siri V3 analysis/"
)
python analysis\steps\94-kagua-siri.py "%BE%" origin/main . > "%TEMP%\push-yote-94.txt" 2>&1
set RC94=%errorlevel%
findstr /b "KINGA_73 COMMIT IMEPATA KAGUA_SIRI" "%TEMP%\push-yote-94.txt" >> %L%
if not "%RC94%"=="0" (
  set KOSA=1
  set "KOSA_LA=kinga ya siri backend"
)
del "%TEMP%\push-yote-94.txt" 2> nul
if not "%KOSA%"=="0" (
  echo ---IMEKATALIWA: %KOSA_LA% - hakuna kilichopushwa--- >> %L%
  echo IMEKATALIWA - soma %L%. Hakuna kilichopushwa.
  goto end
)
if "%KAZI%"=="0" (
  echo ---HAKUNA-CHA-KUPUSH: origin iko sawa na local kwa matawi yote--- >> %L%
  echo ---OK--- >> %L%
  echo Hakuna cha kupush - matawi na tag zote %IDADI% ziko sawa na origin. Matokeo: %L%
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
call :push "%V3%" main 3
if not "%KOSA%"=="0" goto fail
call :push "%BE%" feature/c2-null-params 4
if not "%KOSA%"=="0" goto fail
call :push "%BE%" main 5
if not "%KOSA%"=="0" goto fail
call :push_tag "%BE%" v2.4.0 6
if not "%KOSA%"=="0" goto fail
call :push_tag "%V3%" v3.2.0 7
if not "%KOSA%"=="0" goto fail
call :push_tag "%BE%" v2.5.0 8
if not "%KOSA%"=="0" goto fail
call :push_tag "%V3%" v3.3.0 9
if not "%KOSA%"=="0" goto fail
for /l %%i in (10,1,%IDADI%) do (
  call :push "!AUTO_R_%%i!" !AUTO_B_%%i! %%i
  if not "!KOSA!"=="0" goto fail
)
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

rem :kagua_tag "<repo>" <tag> <namba> - tag lazima iwe local; origin HAKUNA = MPYA, sawa = TAYARI, tofauti = KATAA.
:kagua_tag
set "R=%~1"
set "B=%~2"
set "LH="
set "RH="
for /f "usebackq delims=" %%h in (`git -C "%R%" rev-parse --verify --quiet refs/tags/%B%`) do set "LH=%%h"
if not defined LH (
  echo TAG_%~3 %B% SIYO: haipo local kwenye %R% >> %L%
  set KOSA=%~3
  set "KOSA_LA=%B%"
  goto :eof
)
for /f "usebackq tokens=1" %%h in (`git -C "%R%" ls-remote origin refs/tags/%B%`) do set "RH=%%h"
if not defined RH (
  echo TAG_%~3 %B% local !LH! origin HAKUNA - itaundwa MPYA >> %L%
  set "HALI_%~3=MPYA"
  set /a KAZI+=1
  goto :eof
)
if "!RH!"=="!LH!" (
  echo TAG_%~3 %B% local !LH! origin !RH! - TAYARI >> %L%
  set "HALI_%~3=TAYARI"
  goto :eof
)
echo TAG_%~3 %B% local !LH! origin !RH! - SIYO: origin ina tag hii kwa hash nyingine - KATAA, hakuna force >> %L%
set KOSA=%~3
set "KOSA_LA=%B%"
goto :eof

rem :push_tag "<repo>" <tag> <namba> - push ya tag moja bila force, kisha origin lazima = local.
:push_tag
set "R=%~1"
set "B=%~2"
if "!HALI_%~3!"=="TAYARI" (
  echo PUSH_%~3 %B% - TAYARI, imerukwa >> %L%
  goto :eof
)
set "LH="
set "RH="
for /f "usebackq delims=" %%h in (`git -C "%R%" rev-parse --verify --quiet refs/tags/%B%`) do set "LH=%%h"
git -C "%R%" push origin refs/tags/%B%:refs/tags/%B% >> %L% 2>&1
set RC=!errorlevel!
for /f "usebackq tokens=1" %%h in (`git -C "%R%" ls-remote origin refs/tags/%B%`) do set "RH=%%h"
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

rem :gundua "<repo>" - kila feature/t2-* ya local: namba IDADI+1, AUTO_R_n / AUTO_B_n, kisha :kagua.
:gundua
for /f "usebackq delims=" %%b in (`git -C "%~1" for-each-ref --format^=%%^(refname:short^) refs/heads/feature/t2-*`) do (
  set /a IDADI+=1
  set "AUTO_R_!IDADI!=%~1"
  set "AUTO_B_!IDADI!=%%b"
  call :kagua "%~1" %%b !IDADI!
)
goto :eof

:end
endlocal
