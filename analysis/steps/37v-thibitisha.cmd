@echo off
rem HATUA 37v-thibitisha - KUSOMA TU, HAKUNA BUILD WALA PUSH: inathibitisha kwenye Docker Hub kwamba chiefmaster/lsms-frontend-v3:3.1.11
rem   ina digest sha256:80a4bb7b81841a9fd8407945a991e99fc2218e6b676bae29073674fa0aae1aa6 (push ya 37v, 21/10)
rem   na label org.opencontainers.image.revision = commit kamili ya ef4e097 (deploy-v3.ps1 inaiweka wakati wa build).
rem   Inaandika V3_DIGEST ambayo 38e na 45h zinasoma, na ---OK--- ambayo 38e inaitaka kama sharti.
rem Inahitaji Docker Desktop (docker buildx imagetools inspect - inasoma registry tu).
rem Kinga: inakataa kuanza ikiwa log ya 41 haiishii ---OK---.
rem Matokeo: analysis\steps\37v-thibitisha-3111.log
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
set L=analysis\steps\37v-thibitisha-3111.log
set STEP=
set RC=
echo ---MWENDESHO-37v-thibitisha--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\41-toleo1-kosa-la-gl.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 41 haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 41 haikuisha na ---OK---. Soma analysis\steps\41-toleo1-kosa-la-gl.log na umalize 41 kwanza. 37v-thibitisha haijaendeshwa.
  goto end
)
set STEP=REGISTRY-DIGEST
echo ---%STEP%--- >> %L%
docker buildx imagetools inspect chiefmaster/lsms-frontend-v3:3.1.11 > analysis\steps\37v-thibitisha-inspect.txt 2>&1
set RC=%errorlevel%
type analysis\steps\37v-thibitisha-inspect.txt >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "RD="
for /f "usebackq tokens=1,2" %%a in ("analysis\steps\37v-thibitisha-inspect.txt") do if "%%a"=="Digest:" set "RD=%%b"
echo digest ya registry: %RD% >> %L%
if not "%RD%"=="sha256:80a4bb7b81841a9fd8407945a991e99fc2218e6b676bae29073674fa0aae1aa6" (
  echo SIYO: digest ya registry si sha256:80a4bb7b81841a9fd8407945a991e99fc2218e6b676bae29073674fa0aae1aa6 >> %L%
  set RC=1
  goto fail
)
del /q analysis\steps\37v-thibitisha-inspect.txt
set STEP=REGISTRY-REVISION-NI-EF4E097
echo ---%STEP%--- >> %L%
set "FULL="
for /f %%c in ('git -C "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3" rev-parse --verify ef4e097') do set "FULL=%%c"
echo commit kamili ya ef4e097: %FULL% >> %L%
if not defined FULL (
  echo SIYO: git haijui ef4e097 >> %L%
  set RC=1
  goto fail
)
docker buildx imagetools inspect chiefmaster/lsms-frontend-v3:3.1.11 --format "{{json .Image.Config.Labels}}" > analysis\steps\37v-thibitisha-labels.txt 2>&1
set RC=%errorlevel%
type analysis\steps\37v-thibitisha-labels.txt >> %L%
echo. >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /l /c:"org.opencontainers.image.revision" analysis\steps\37v-thibitisha-labels.txt | findstr /l /c:"%FULL%" > nul
if errorlevel 1 (
  echo SIYO: label ya revision ya image si %FULL% >> %L%
  set RC=1
  goto fail
)
del /q analysis\steps\37v-thibitisha-labels.txt
echo V3_DIGEST %RD%>> %L%
echo ---OK--- >> %L%
echo OK - chiefmaster/lsms-frontend-v3:3.1.11 kwenye registry = %RD%, commit ef4e097. Matokeo: %L%. Sasa unaweza kuendesha 38e.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Hakuna kilichobadilishwa.
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
