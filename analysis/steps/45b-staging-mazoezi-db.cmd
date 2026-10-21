@echo off
rem HATUA 45b - MAZOEZI YA §1.8, SEHEMU 1: INABADILISHA STAGING TU. Production HAIGUSWI (ps tu, kabla na baada).
rem DB ya staging inafutwa na kurejeshwa kutoka DUMP MPYA ya 45a (baada ya freeze; jina na sha256 kutoka log ya 45a), kisha backend 2.2.71 ya staging
rem   inaundwa upya ili Flyway iendeshe V134 kama itakavyofanya prod. DB ya sasa ya staging inahifadhiwa kwanza
rem   (~/lsms-staging/staging_kabla_ya_mazoezi_^<tarehe^>.dump).
rem Kisha SQL ya kusoma tu (45-kabla.sql) kwenye staging inaandika analysis\steps\45-mazoezi\data.txt: uids za H-2,
rem   snapshots 2 za Q9, journals 7 za M-7 - data ileile ya prod (dump mpya ya 45a), bila query kwenye DB ya prod.
rem Matokeo ya mazoezi ya zamani (45-mazoezi\*.json) yanafutwa: prod inalinganishwa na mazoezi ya dump hii mpya tu.
rem Password ya root ya staging baada ya hatua hii = ya PROD wakati wa dump mpya (password MPYA ya 20/10).
rem Kinga: inakataa kuanza ikiwa log ya 45a haiishii ---OK---.
rem Matokeo: analysis\steps\45b-staging-mazoezi-db.log
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
set L=analysis\steps\45b-staging-mazoezi-db.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-45b--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\45a-prod-preflight.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 45a haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 45a haikuisha na ---OK---. Soma analysis\steps\45a-prod-preflight.log na umalize 45a kwanza. 45b haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
if not exist analysis\steps\45-mazoezi mkdir analysis\steps\45-mazoezi
del /q analysis\steps\45-mazoezi\*.json 2>nul
del /q analysis\steps\45-mazoezi\data.txt 2>nul
set "FZ="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$m = @(Select-String -LiteralPath 'analysis\steps\45a-prod-preflight.log' -CaseSensitive -Pattern '^FREEZE_EPOCH (\S+)\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); if ($m.Count -eq 1 -and $m[0] -cmatch '^\d{9,11}$') { $m[0] } else { 'KOSA:' + ($m -join ',') }"`) do set "FZ=%%v"
if not defined FZ set "FZ=KOSA:"
echo FREEZE_EPOCH kutoka 45a: %FZ% >> %L%
if "%FZ:~0,5%"=="KOSA:" (
  echo SIYO: FREEZE_EPOCH kwenye analysis\steps\45a-prod-preflight.log haipo, si moja, au muundo wake si sahihi >> %L%
  set STEP=45A-FREEZE-EPOCH
  set RC=1
  goto fail
)
set "DJ="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$m = @(Select-String -LiteralPath 'analysis\steps\45a-prod-preflight.log' -CaseSensitive -Pattern '^DUMP_MPYA_JINA (\S+)\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); if ($m.Count -eq 1 -and $m[0] -cmatch '^lsms_\d{8}_\d{4}\.dump$') { $m[0] } else { 'KOSA:' + ($m -join ',') }"`) do set "DJ=%%v"
if not defined DJ set "DJ=KOSA:"
echo DUMP_MPYA_JINA kutoka 45a: %DJ% >> %L%
if "%DJ:~0,5%"=="KOSA:" (
  echo SIYO: DUMP_MPYA_JINA kwenye analysis\steps\45a-prod-preflight.log haipo, si moja, au muundo wake si sahihi >> %L%
  set STEP=45A-DUMP-MPYA-JINA
  set RC=1
  goto fail
)
set "DSHA="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$m = @(Select-String -LiteralPath 'analysis\steps\45a-prod-preflight.log' -CaseSensitive -Pattern '^DUMP_MPYA_SHA256 (\S+)\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); if ($m.Count -eq 1 -and $m[0] -cmatch '^[0-9a-f]{64}$') { $m[0] } else { 'KOSA:' + ($m -join ',') }"`) do set "DSHA=%%v"
if not defined DSHA set "DSHA=KOSA:"
echo DUMP_MPYA_SHA256 kutoka 45a: %DSHA% >> %L%
if "%DSHA:~0,5%"=="KOSA:" (
  echo SIYO: DUMP_MPYA_SHA256 kwenye analysis\steps\45a-prod-preflight.log haipo, si moja, au muundo wake si sahihi >> %L%
  set STEP=45A-DUMP-MPYA-SHA256
  set RC=1
  goto fail
)
set STEP=HAKIKI-DUMP-MPYA-YA-45A
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { J=$(cat /tmp/staging-restore/JINA) && echo $J && [ $J = %DJ% ] && case $J in lsms_$(TZ=Africa/Dar_es_Salaam date +%%Y%%m%%d)_*.dump) true;; *) false;; esac && [ $(stat -c %%Y ~/backups/daily/$J) -gt %FZ% ] && [ $(sha256sum /tmp/staging-restore/$J | cut -d' ' -f1) = %DSHA% ] && [ $(sha256sum ~/backups/daily/$J | cut -d' ' -f1) = %DSHA% ] && echo SHA_SAWA_NA_45A; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45b-staging-mazoezi-db.log" SHA_SAWA_NA_45A
if not defined NIMEPATA (
  echo SIYO: dump ya staging-restore si ile ya 45a >> %L%
  set RC=1
  goto fail
)
set STEP=PROD-PS-KABLA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-LAZIMA-2.2.71
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && echo TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9') && [ $(grep -c '^BACKEND_VERSION=' .env) = 1 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45b-staging-mazoezi-db.log" TOLEO_ENV_2271
if not defined NIMEPATA (
  echo SIYO: ishara TOLEO_ENV_2271 haipo - .env ya staging si toleo 2.2.71 >> %L%
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
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && D=$(TZ=Africa/Dar_es_Salaam date +%%Y%%m%%d_%%H%%M) && docker compose -p lsms-staging exec -T postgres pg_dump -U postgres -Fc Lsms > ~/lsms-staging/staging_kabla_ya_mazoezi_${D}.dump && ls -l ~/lsms-staging/staging_kabla_ya_mazoezi_${D}.dump && test -s ~/lsms-staging/staging_kabla_ya_mazoezi_${D}.dump; } 2>&1 | awk %F%" >> %L% 2>&1
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
set STEP=STAGING-FLYWAY-LAZIMA-133
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version from flyway_schema_history order by installed_rank desc limit 1' | tee /dev/stderr | grep -qx 133 && echo STAGING_FLYWAY_133_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-BACKEND-2.2.71-UPYA-FLYWAY-V134
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging up -d --no-deps --force-recreate backend && C=$(docker compose -p lsms-staging ps -q backend) && for i in $(seq 1 60); do docker logs $C 2>&1 | grep -q -E 'Started LsmsApplication|APPLICATION FAILED' && break; sleep 5; done; docker logs $C 2>&1 | grep -E 'Migrating schema|Successfully applied|Started LsmsApplication|APPLICATION FAILED' | tail -5 | cut -c1-300; docker logs $C 2>&1 | grep -q 'Started LsmsApplication' && docker inspect --format '{{.Config.Image}}' $C | grep -qx 'chiefmaster/my-lsms-backend:2.2.71' && echo STAGING_BACKEND_2271_IMEWAKA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-FLYWAY-LAZIMA-134
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version from flyway_schema_history order by installed_rank desc limit 1' | tee /dev/stderr | grep -qx 134 && echo STAGING_FLYWAY_134_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=DATA-YA-DUMP-YA-LEO-KUSOMA-TU
echo ---%STEP%--- >> %L%
ssh %SSHO% contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1; } 2>&1 | awk %F%" < analysis\steps\45-kabla.sql > analysis\steps\45-mazoezi\data.txt 2>&1
set RC=%errorlevel%
type analysis\steps\45-mazoezi\data.txt >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45b-staging-mazoezi-db.log" STAGING_BACKEND_2271_IMEWAKA
if not defined NIMEPATA (
  echo SIYO: backend ya staging 2.2.71 haikuwaka >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45b-staging-mazoezi-db.log" STAGING_FLYWAY_134_SAWA
if not defined NIMEPATA (
  echo SIYO: Flyway ya staging si 134 >> %L%
  set RC=1
  goto fail
)
set STEP=STAGING-PS
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
echo OK - staging imerejeshwa kutoka dump mpya %DJ% ya 45a, 2.2.71 na Flyway 134; data ya mazoezi: analysis\steps\45-mazoezi\data.txt. Matokeo: %L%. Sasa: tunnel.cmd wazi, kisha 45c.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Prod haijaguswa.
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
