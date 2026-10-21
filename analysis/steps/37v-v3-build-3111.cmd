@echo off
rem HATUA 37v - BUILD YA V3 3.1.11 (Toleo 1 la frontend: kadi ya makosa ya GL, tab ya vipindi, alama ya late entry).
rem   deploy\deploy-v3.ps1 -BuildOnly kwenye PC: working tree safi (analysis\ peke yake inaruhusiwa), docker build, docker push
rem   ya 3.1.11 TU - server haiguswi, .frontend-v3-version haibadilishwi. Lazima BUILD_OK 3.1.11 (ikitoa namba nyingine: SIMAMA).
rem   Inahitaji Docker Desktop na docker login. Branch lazima iwe main na iwe na commit ef4e097 (GL Toleo 1 3.1.11).
rem Kinga: inakataa kuanza ikiwa log ya 41 haiishii ---OK---, au ikiwa chiefmaster/lsms-frontend-v3:3.1.11 TAYARI IPO kwenye Docker Hub
rem   (tag haitumiki mara mbili; au ikiwa registry haijibu). Baada ya OK: endesha 37v-thibitisha (38e inaitegemea).
rem Matokeo: analysis\steps\37v-v3-build-3111.log
rem Kanuni za §1.8 (mmiliki 20/10): kila hatua inakataa kuanza ikiwa log ya hatua iliyotangulia haiishii ---OK---;
rem   kila output ya Contabo inapita ficha.awk kwenye server; ssh zote %SSHO% -n; toleo linakaguliwa kwa ishara za server;
rem   password zinaulizwa bila kuonekana (PowerShell Read-Host -AsSecureString) na haziandikwi kwenye log wala faili lolote.
rem Akaunti: marekebisho, M-7 na kufunga vipindi = akaunti ya CEO (mmiliki), SI root; root ni ya (a) / (b2) / (d) tu.
rem Hakuna query kwenye DB ya prod (kanuni ya 15/10): prod inasomwa kwa API, docker ps/inspect/logs, na dump ya usiku.
rem ONYO: kuanzia FREEZE (mmiliki 21/10: kabla ya 37v, hadi 12:00 mchana) hadi mwisho wa 47 HAKUNA mtu anayetumia LSMS (sales,
rem   reco, capex, malipo...): mazoezi ni ya DUMP MPYA ya 45a (baada ya freeze); 45a na 45d zinasimama zikiona ombi lolote la
rem   kuandika kwenye nginx tangu freeze, na 46a/46b/43/47 zinasimama namba zikitofautiana na mazoezi.
rem Dirisha: usiku 02:30-05:59 EAT bila kibali; ASUBUHI kwa kibali cha mmiliki tu (set LSMS_DIRISHA=ASUBUHI + kuandika asubuhi
rem   kwenye swali; kinaandikwa kwenye log): 45a/45d 06:00-09:59 (45d haianzi kuanzia 10:00 - deploy si leo), 44 na 46a/46b/43/47
rem   06:00-11:29 (freeze inaisha 12:00).
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\37v-v3-build-3111.log
set STEP=
set RC=
echo ---MWENDESHO-37v--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\41-toleo1-kosa-la-gl.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 41 haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 41 haikuisha na ---OK---. Soma analysis\steps\41-toleo1-kosa-la-gl.log na umalize 41 kwanza. 37v haijaendeshwa.
  goto end
)
set STEP=TAG-3.1.11-HAIPO-KWENYE-REGISTRY
echo ---%STEP%--- >> %L%
docker manifest inspect chiefmaster/lsms-frontend-v3:3.1.11 > analysis\steps\37v-manifest.txt 2>&1
set RC=%errorlevel%
type analysis\steps\37v-manifest.txt >> %L%
echo [exit %RC%] >> %L%
if "%RC%"=="0" (
  echo SIYO: chiefmaster/lsms-frontend-v3:3.1.11 tayari ipo kwenye registry - 37v haijengi tena; endesha 37v-thibitisha >> %L%
  echo IMEKATALIWA: chiefmaster/lsms-frontend-v3:3.1.11 tayari ipo. Usijenge tena - endesha 37v-thibitisha.
  set RC=1
  goto fail
)
findstr /l /c:"no such manifest" analysis\steps\37v-manifest.txt > nul
if errorlevel 1 (
  echo SIYO: registry haikujibu no such manifest - haiwezi kuthibitisha kwamba tag haipo >> %L%
  set RC=1
  goto fail
)
del /q analysis\steps\37v-manifest.txt
set STEP=BRANCH-NA-COMMIT
echo ---%STEP%--- >> %L%
set "BR="
for /f %%b in ('git -C "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3" rev-parse --abbrev-ref HEAD') do set "BR=%%b"
echo branch %BR% >> %L%
git -C "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3" log -1 --format="%%h %%s" >> %L% 2>&1
if not "%BR%"=="main" (
  echo SIYO: branch si main >> %L%
  set RC=1
  goto fail
)
git -C "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3" merge-base --is-ancestor ef4e097 HEAD
if errorlevel 1 (
  echo SIYO: HEAD haina ef4e097 >> %L%
  set RC=1
  goto fail
)
set STEP=BUILD-V3
echo ---%STEP%--- >> %L%
if exist analysis\steps\37v-transcript.txt del /q analysis\steps\37v-transcript.txt
powershell -NoProfile -ExecutionPolicy Bypass -File analysis\steps\45-deploy.ps1 -Transcript "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\37v-transcript.txt" -Kind v3 -Mode BuildOnly
set RC=%errorlevel%
type analysis\steps\37v-transcript.txt >> %L% 2>nul
echo [exit %RC%] >> %L%
findstr /l /c:"BUILD_OK 3.1.11" analysis\steps\37v-transcript.txt > nul
if errorlevel 1 (
  echo SIYO: hakuna BUILD_OK 3.1.11 kwenye maandishi ya script >> %L%
  set RC=1
  goto fail
)
del /q analysis\steps\37v-transcript.txt
set "V3D="
for /f "tokens=2" %%d in ('findstr /l /c:"Digest:" %L%') do set "V3D=%%d"
if not "%V3D:~0,7%"=="sha256:" (
  echo SIYO: digest haikupatikana kwenye maandishi ya build >> %L%
  set STEP=V3-DIGEST
  set RC=1
  goto fail
)
echo V3_DIGEST %V3D%>> %L%
echo ---OK--- >> %L%
echo OK - BUILD_OK 3.1.11, digest %V3D%. Matokeo: %L%. Sasa endesha 37v-thibitisha, kisha 38e.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Server haijaguswa. USIENDESHE 37v tena ikiwa push ilifanyika - endesha 37v-thibitisha.
:end
set CEO_PASS=
set ROOT_PASS=
set PGPASSWORD=
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
rem :mwisho_ni "<faili>" <neno> - NIMEPATA=1 ikiwa mstari wa MWISHO usio tupu wa <faili> ni <neno> PEKE YAKE
rem (bila kujali nafasi, tab au ). Faili lisilokuwepo = HAPANA.
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
