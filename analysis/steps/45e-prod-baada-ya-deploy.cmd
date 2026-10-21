@echo off
rem HATUA 45e - BAADA YA DEPLOY (KUSOMA TU): container ya backend ya prod inaendesha image yenye digest ya staging,
rem   .env ya prod ni 2.2.71 (ishara TOLEO_ENV_2271), log ya CONTAINER HII (imeundwa upya na deploy, kwa hiyo ni mpya)
rem   inaonyesha Started LsmsApplication bila ERROR ya startup, na https://elikom.co.tz/api inajibu 400 kwa login tupu.
rem Flyway v134: log ya backend ya prod iko WARN (haina mistari ya Flyway - 38c ilionyesha Started tu), kwa hiyo v134 inasomwa
rem   kutoka log ya 45d: script ya deploy inaandika Flyway applied: 134 ... [success=true] (rank kabla/baada ya deploy).
rem Kinga: inakataa kuanza ikiwa log ya 45d haiishii ---OK---.
rem Matokeo: analysis\steps\45e-prod-baada-ya-deploy.log
rem Kanuni za §1.8 (mmiliki 20/10): kila hatua inakataa kuanza ikiwa log ya hatua iliyotangulia haiishii ---OK---;
rem   kila output ya Contabo inapita ficha.awk kwenye server; ssh zote %SSHO% -n; toleo linakaguliwa kwa ishara za server;
rem   password zinaulizwa bila kuonekana (PowerShell Read-Host -AsSecureString) na haziandikwi kwenye log wala faili lolote.
rem Akaunti: marekebisho, M-7 na kufunga vipindi = akaunti ya CEO (mmiliki), SI root; root ni ya (a) / (b2) / (d) tu.
rem Hakuna query kwenye DB ya prod (kanuni ya 15/10): prod inasomwa kwa API, docker ps/inspect/logs, na dump ya usiku.
rem ONYO: kuanzia FREEZE (mmiliki 21/10: umeme wa duka umekatika hadi 16:00) hadi mwisho wa 47 HAKUNA mtu anayetumia LSMS (sales,
rem   reco, capex, malipo...): mazoezi ni ya DUMP MPYA ya 45a (baada ya freeze); 45a na 45d zinasimama zikiona ombi lolote la
rem   kuandika kwenye nginx tangu freeze, na 46a/46b/43/47 zinasimama namba zikitofautiana na mazoezi.
rem Dirisha: usiku 02:30-05:59 EAT bila kibali; mchana kwa kibali cha mmiliki tu (set LSMS_DIRISHA=ASUBUHI + kuandika asubuhi
rem   kwenye swali; kinaandikwa kwenye log): 45a/45d 06:00-13:59 (45d haianzi kuanzia 14:00 - deploy si leo), 44 na 46a/46b/43/47
rem   06:00-15:14 (umeme wa duka unarudi 16:00; mmiliki 21/10).
rem Kila sehemu inaandika [exit N]; stdout NA stderr ya kila amri ya Contabo zinapita kwenye ficha.awk KWENYE SERVER.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\45e-prod-baada-ya-deploy.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-45e--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\45d-prod-deploy.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 45d haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 45d haikuisha na ---OK---. Soma analysis\steps\45d-prod-deploy.log na umalize 45d kwanza. 45e haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PROD-PS
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PROD-ENV-2.2.71
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && echo TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9') && [ $(grep -c '^BACKEND_VERSION=' .env) = 1 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45e-prod-baada-ya-deploy.log" TOLEO_ENV_2271
if not defined NIMEPATA (
  echo SIYO: ishara TOLEO_ENV_2271 haipo - .env ya staging si toleo 2.2.71 >> %L%
  set RC=1
  goto fail
)
set STEP=PROD-DIGEST-SAWA-NA-STAGING
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && C=$(docker compose ps -q backend) && I=$(docker inspect --format '{{.Image}}' $C) && echo container ${C:0:12} image ${I:0:19} $(docker inspect --format '{{.Config.Image}}' $C) && docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' $I | grep -qx 'chiefmaster/my-lsms-backend@sha256:047084562507162306daf153adbcf3b00884883b6f84f860f0c8461c3ece35d2' && echo PROD_DIGEST_SAWA_NA_STAGING; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PROD-LOG-YA-CONTAINER-HII
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && C=$(docker compose ps -q backend) && docker inspect --format 'imeanza {{.State.StartedAt}} restarts {{.RestartCount}}' $C && docker logs $C 2>&1 | grep -E 'Current version of schema|Migrating schema|Successfully applied|No migration necessary|Started LsmsApplication|APPLICATION FAILED' | tail -8 | cut -c1-300; echo ERROR_ZA_STARTUP $(docker logs $C 2>&1 | sed '/Started LsmsApplication/q' | grep -c ' ERROR '); docker logs $C 2>&1 | grep -q 'Started LsmsApplication' && echo PROD_BACKEND_IMEWAKA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PROD-PUBLIC-API-400
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { C=$(curl -s -o /dev/null -m 15 -w '%%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' https://elikom.co.tz/api/auth/login | tr -dc '0-9') && echo HTTP_$C && [ x$C = x400 ] && echo PUBLIC_API_400; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45e-prod-baada-ya-deploy.log" PROD_DIGEST_SAWA_NA_STAGING
if not defined NIMEPATA (
  echo SIYO: digest ya prod si ya staging - SIMAMA >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45e-prod-baada-ya-deploy.log" PROD_BACKEND_IMEWAKA
if not defined NIMEPATA (
  echo SIYO: Started LsmsApplication haipo kwenye log ya container >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45e-prod-baada-ya-deploy.log" PUBLIC_API_400
if not defined NIMEPATA (
  echo SIYO: https://elikom.co.tz/api haijibu 400 >> %L%
  set RC=1
  goto fail
)
set STEP=FLYWAY-134-KUTOKA-LOG-YA-45D
echo ---%STEP%--- >> %L%
findstr /l /c:"Flyway applied: 134 " analysis\steps\45d-prod-deploy.log >> %L%
if errorlevel 1 (
  echo SIYO: log ya 45d haina Flyway applied: 134 >> %L%
  set RC=1
  goto fail
)
findstr /l /c:"Flyway applied: 134 " analysis\steps\45d-prod-deploy.log | findstr /l /c:"[success=true]" > nul
if errorlevel 1 (
  echo SIYO: V134 haikuandikwa success=true >> %L%
  set RC=1
  goto fail
)
echo PROD_FLYWAY_134_SAWA >> %L%
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - prod inaendesha 2.2.71 yenye digest ya staging, Flyway v134. Matokeo: %L%. Sasa unaweza kuendesha 44 (JWT_SECRET).
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Nitumie log kabla ya kuendelea.
:end
set ROOT_PASS=
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
