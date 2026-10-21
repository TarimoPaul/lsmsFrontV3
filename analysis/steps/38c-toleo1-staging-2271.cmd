@echo off
rem HATUA 38c - INABADILISHA STAGING TU: backend ya staging 2.2.70 -^> 2.2.71 (Toleo 1).
rem Endesha baada ya 37 (BUILD_OK 2.2.71, mimi nimethibitisha digest) na 38b (---OK---, Flyway 133).
rem Flyway itaendesha migration MOJA: V134__Gl_Posting_Failure_And_Period_Close.sql
rem   (jedwali jipya gl_posting_failure na gl_period_audit; safu mpya variance_kind, variance_target, event_date, is_late_entry,
rem    closed_by_uid, checks_json; index ya mwezi mmoja kwa gl_period; akaunti 2900. Hakuna thamani iliyopo inayobadilishwa.)
rem Kinga: linakataa kuanza ikiwa log ya 38b haiishii ---OK---
rem        au log ya 37 haina [OK] BUILD_OK 2.2.71.
rem Salama kurudiwa: .env 2.2.70 bila backup -^> backup .env.bak.kabla-ya-2271 + BACKEND_VERSION=2.2.71 (HALI_38C_MPYA);
rem   .env tayari 2.2.71 na backup ipo ya 2.2.70 -^> hakuna kinachobadilishwa kwenye .env (HALI_38C_RUDIA), inaendelea na up -d;
rem   hali nyingine yoyote -^> HALI_38C_KATAA. Tofauti kati ya .env na backup lazima iwe mstari wa toleo tu (ENV_2271_BACKUP_2270_SAWA).
rem   Flyway ya staging lazima bado iwe 133. Toleo linakaguliwa kwenye server: ishara TOLEO_ENV_2271, si mstari wa .env (ficha unauficha).
rem Kinachobadilika: nakala ya .env (mara ya kwanza tu), mstari wa BACKEND_VERSION, container ya backend ya staging.
rem Production (~/lsms-deployment) HAIGUSWI - ps tu mwishoni.
rem Lazima: Started LsmsApplication, ERROR 0, mistari ya 38-thibitisha-134.sql yote kama LAZIMA zake.
rem Matokeo: analysis\steps\38c-toleo1-staging-2271.log
rem Kila sehemu inaandika [exit N]; stdout NA stderr ya kila amri ya Contabo zinapita kwenye ficha.awk KWENYE SERVER.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\38c-toleo1-staging-2271.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-38c--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\38b-toleo1-restore-staging.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 38b haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 38b haikuisha na ---OK---. Soma analysis\steps\38b-toleo1-restore-staging.log na umalize 38b kwanza. 38c haijaendeshwa.
  goto end
)
set "NIMEPATA="
call :mwisho_ni "analysis\steps\37-toleo1-build-2271.log" ---MWISHO---
if defined NIMEPATA (
  findstr /b /l /c:"[OK] BUILD_OK 2.2.71" analysis\steps\37-toleo1-build-2271.log > nul
  if errorlevel 1 set "NIMEPATA="
)
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 37 haina [OK] BUILD_OK 2.2.71 na ---MWISHO--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 37 haikuisha na BUILD_OK 2.2.71. Soma analysis\steps\37-toleo1-build-2271.log. 38c haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-HALI-KABLA-KUSOMA-TU
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging; echo env TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9'); echo mistari ya toleo kwenye env $(grep -c '^BACKEND_VERSION=' .env); if [ -f .env.bak.kabla-ya-2271 ]; then echo backup TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env.bak.kabla-ya-2271 | cut -d= -f2 | tr -dc '0-9'); echo mistari inayotofautiana env na backup $(diff .env.bak.kabla-ya-2271 .env 2>/dev/null | grep -c '^[<>]'); echo kati yake isiyo ya toleo $(diff .env.bak.kabla-ya-2271 .env 2>/dev/null | grep '^[<>]' | grep -vc '^[<>] BACKEND_VERSION='); else echo backup HAIPO; fi; echo backend inayoendesha $(docker compose -p lsms-staging ps --format '{{.Image}}' backend); echo HALI_KABLA_IMESOMWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
set STEP=STAGING-FLYWAY-LAZIMA-133
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version from flyway_schema_history order by installed_rank desc limit 1' | tee /dev/stderr | grep -qx 133 && echo STAGING_FLYWAY_133_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-ENV-2.2.71-SALAMA-KURUDIWA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && N=$(grep -c '^BACKEND_VERSION=' .env); if [ x$N = x1 ] && grep -qx 'BACKEND_VERSION=2.2.70' .env && [ ! -e .env.bak.kabla-ya-2271 ]; then cp -p .env .env.bak.kabla-ya-2271 && sed -i 's/^BACKEND_VERSION=.*/BACKEND_VERSION=2.2.71/' .env && echo HALI_38C_MPYA; elif [ x$N = x1 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env && [ -f .env.bak.kabla-ya-2271 ] && grep -qx 'BACKEND_VERSION=2.2.70' .env.bak.kabla-ya-2271 && [ $(grep -c '^BACKEND_VERSION=' .env.bak.kabla-ya-2271) = 1 ]; then echo HALI_38C_RUDIA; else echo HALI_38C_KATAA; false; fi; R=$?; T=$(diff .env.bak.kabla-ya-2271 .env 2>/dev/null | grep -c '^[<>]'); X=$(diff .env.bak.kabla-ya-2271 .env 2>/dev/null | grep '^[<>]' | grep -vc '^[<>] BACKEND_VERSION='); echo mistari inayotofautiana $T isiyo ya toleo $X; [ $R = 0 ] && [ x$T = x2 ] && [ x$X = x0 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env && echo ENV_2271_BACKUP_2270_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\38c-toleo1-staging-2271.log" ENV_2271_BACKUP_2270_SAWA
if not defined NIMEPATA (
  echo SIYO: env si 2.2.71 au tofauti na backup si mstari wa toleo tu >> %L%
  set RC=1
  goto fail
)
set STEP=STAGING-PULL-IMAGE
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging pull -q backend && docker image inspect chiefmaster/my-lsms-backend:2.2.71 --format '{{index .RepoDigests 0}}'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-WASHA-BACKEND-2.2.71
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging up -d backend && docker compose -p lsms-staging ps --format '{{.Image}}' backend | grep -qx 'chiefmaster/my-lsms-backend:2.2.71' && echo BACKEND_INAYOENDESHA_2271; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-LOG-YA-BACKEND
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && for i in $(seq 1 48); do docker compose -p lsms-staging logs backend | grep -q -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed' && break; sleep 5; done; docker compose -p lsms-staging logs --no-color backend | grep -E 'Current version of schema|Migrating schema|Successfully applied|No migration necessary|Started LsmsApplication|APPLICATION FAILED|Application run failed|ERROR' | tail -40 | cut -c1-400; docker compose -p lsms-staging logs --no-color backend | grep -q 'Started LsmsApplication' && echo STAGING_BACKEND_IMEWAKA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-IDADI-YA-ERROR
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging logs backend | grep -c ' ERROR '; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] (grep: 1 = ERROR 0, si kosa) >> %L%
set STEP=STAGING-BAADA-YA-V134-READ-ONLY
echo ---%STEP%--- >> %L%
ssh %SSHO% contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1; } 2>&1 | awk %F%" < analysis\steps\38-thibitisha-134.sql >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-PS
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging ps -a --format 'table {{.Service}} {{.Image}} {{.Status}}' && echo env ya staging TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9'); } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
set STEP=PROD-PS
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - staging inaendesha 2.2.71 na Flyway 134. Matokeo: %L%. Sasa unaweza kuendesha 38d.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Hatua zilizofuata HAZIKUENDESHWA.
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
