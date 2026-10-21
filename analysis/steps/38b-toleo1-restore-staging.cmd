@echo off
rem HATUA 38b - INABADILISHA STAGING TU: DB ya staging inafutwa na kurejeshwa kutoka dump ya leo (38a).
rem Endesha baada ya 38a kuishia na SHA_SAWA, DUMP_FLYWAY_133_SAWA na ---OK---. Production (~/lsms-deployment) HAIGUSWI - ps tu, kabla na baada.
rem Kinga: inakataa kuanza ikiwa log ya 38a haiishii ---OK---.
rem Mpangilio: hakiki dump tena (cmp), simamisha backend ya staging, HIFADHI DB ya sasa ya staging
rem            (~/lsms-staging/staging_kabla_ya_toleo1_^<tarehe^>.dump - ina sales za QA-H2 za hatua 36),
rem            dropdb + createdb Lsms (container ya postgres ya STAGING tu), pg_restore.
rem Backend ya staging INABAKI IMESIMAMA (bado 2.2.70). Hatua 38c ndiyo inaiwasha kwa 2.2.71 (V134).
rem Lazima mwishoni: Flyway ya mwisho ya staging = 133 (STAGING_FLYWAY_133_SAWA).
rem Password ya root ya staging baada ya hatua hii = ya PROD wakati wa dump hii (dump ya 20/10 02:00 = password ya ZAMANI,
rem   kabla ya kubadilishwa kwenye prod 20/10). Restore ya baadaye italeta password MPYA ya prod.
rem Matokeo: analysis\steps\38b-toleo1-restore-staging.log
rem Kila sehemu inaandika [exit N]; stdout NA stderr ya kila amri ya Contabo zinapita kwenye ficha.awk KWENYE SERVER.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\38b-toleo1-restore-staging.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-38b--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\38a-toleo1-pakua-dump.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 38a haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 38a haikuisha na ---OK---. Soma analysis\steps\38a-toleo1-pakua-dump.log na umalize 38a kwanza. 38b haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=HAKIKI-DUMP-TENA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { J=$(cat /tmp/staging-restore/JINA) && echo $J && cmp /tmp/staging-restore/$J ~/backups/daily/$J && echo SHA_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PROD-PS-KABLA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-LAZIMA-2.2.70
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && echo TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9') && [ $(grep -c '^BACKEND_VERSION=' .env) = 1 ] && grep -qx 'BACKEND_VERSION=2.2.70' .env; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\38b-toleo1-restore-staging.log" TOLEO_ENV_2270
if not defined NIMEPATA (
  echo SIYO: ishara TOLEO_ENV_2270 haipo - .env ya staging si toleo 2.2.70 >> %L%
  set RC=1
  goto fail
)
set STEP=STAGING-SIMAMISHA-BACKEND
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging stop backend; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-HIFADHI-DB-YA-SASA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && D=$(TZ=Africa/Dar_es_Salaam date +%%Y%%m%%d) && docker compose -p lsms-staging exec -T postgres pg_dump -U postgres -Fc Lsms > ~/lsms-staging/staging_kabla_ya_toleo1_${D}.dump && ls -l ~/lsms-staging/staging_kabla_ya_toleo1_${D}.dump && test -s ~/lsms-staging/staging_kabla_ya_toleo1_${D}.dump; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-DROPDB
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres dropdb -U postgres --if-exists --force Lsms && echo DROPDB_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-CREATEDB
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres createdb -U postgres Lsms && echo CREATEDB_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-PG-RESTORE
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { J=$(cat /tmp/staging-restore/JINA) && cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_restore -U postgres -d Lsms --no-owner --exit-on-error < /tmp/staging-restore/$J && echo PG_RESTORE_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-FLYWAY-YA-MWISHO-LAZIMA-IWE-133
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version from flyway_schema_history order by installed_rank desc limit 1' | tee /dev/stderr | grep -qx 133 && echo STAGING_FLYWAY_133_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-PS-backend-iwe-Exited
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging ps -a --format 'table {{.Service}} {{.Image}} {{.Status}}' && echo env ya staging TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9'); } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
set STEP=PROD-PS-BAADA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - DB ya staging imerejeshwa kutoka dump ya leo: STAGING_FLYWAY_133_SAWA. Matokeo: %L%. Sasa unaweza kuendesha 38c.
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
