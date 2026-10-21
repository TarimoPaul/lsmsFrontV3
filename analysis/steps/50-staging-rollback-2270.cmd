@echo off
rem HATUA 50 - JARIBIO LA ROLLBACK KWENYE STAGING TU (swali la mmiliki 20/10): deploy ikishindwa BAADA ya V134 kuingia prod,
rem   2.2.70 itawaka juu ya DB yenye V134? Staging ina V134 sasa (38c). Hatua: .env -^> 2.2.70, backend inaundwa upya
rem   kwa image 2.2.70 (iliyopo kwenye server, --pull never), inasubiri Started au kukataa; ikiwaka: API 400 na sale 1 ya cash
rem   QA-RB (50-rollback-sale.mjs) lazima ipate journal SALE_CASH; Flyway haibadiliki. KISHA INARUDI 2.2.71 (hata ikishindwa).
rem   Kwa nini inatarajiwa kuwaka: application.properties ya 2.2.70 = validate-on-migrate=false, ignore-missing-migrations=true,
rem   out-of-order=true (Flyway 9.22.3), na safu mpya za V134 zina DEFAULT. Hatua hii inathibitisha kwa vitendo.
rem Itakuuliza password ya root ya STAGING (ya prod wakati wa dump ya 20/10 = ya ZAMANI); haionekani, haiandikwi.
rem Lazima kwanza: tunnel.cmd wazi. Production HAIGUSWI (ps tu).
rem Kinga: inakataa kuanza ikiwa log ya 38e haiishii ---OK--- (mpangilio 37v -^> 38e -^> 50). Ikishindwa katikati, :fail inarudisha .env kutoka backup na kuwasha 2.2.71.
rem Matokeo: analysis\steps\50-staging-rollback-2270.log
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
rem Kila sehemu inaandika [exit N]; stdout NA stderr ya kila amri ya Contabo zinapita kwenye ficha.awk KWENYE SERVER.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\50-staging-rollback-2270.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-50--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\38e-staging-v3-3111.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 38e haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 38e haikuisha na ---OK---. Soma analysis\steps\38e-staging-v3-3111.log na umalize 38e kwanza. 50 haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=TUNNEL-LAZIMA-400
echo ---%STEP%--- >> %L%
curl -s -o nul -w "%%{http_code}" -X POST -H "Content-Type: application/json" -d "{}" http://localhost:8081/api/auth/login > analysis\steps\50-tunnel.txt 2>&1
type analysis\steps\50-tunnel.txt >> %L%
echo. >> %L%
set "NIMEPATA="
call :mstari_pekee "analysis\steps\50-tunnel.txt" 400
if not defined NIMEPATA (
  echo SIYO: tunnel haijibu 400 - fungua analysis\steps\tunnel.cmd >> %L%
  set RC=1
  goto fail
)
set STEP=STAGING-LAZIMA-2.2.71
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && echo TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9') && [ $(grep -c '^BACKEND_VERSION=' .env) = 1 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\50-staging-rollback-2270.log" TOLEO_ENV_2271
if not defined NIMEPATA (
  echo SIYO: ishara TOLEO_ENV_2271 haipo - .env ya staging si toleo 2.2.71 >> %L%
  set RC=1
  goto fail
)
set STEP=STAGING-FLYWAY-LAZIMA-134
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version from flyway_schema_history order by installed_rank desc limit 1' | tee /dev/stderr | grep -qx 134 && echo STAGING_FLYWAY_134_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=IMAGE-2.2.70-IPO
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { docker image inspect chiefmaster/my-lsms-backend:2.2.70 --format '{{.Id}}' | cut -c1-19 && echo IMAGE_2270_IPO; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=FLYWAY-KABLA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -c 'select count(*) || chr(124) || max(installed_rank) || chr(124) || count(*) filter (where not success) from flyway_schema_history' | tee /tmp/50-flyway-kabla.txt | sed 's/^/FLYWAY_SAFU_RANK_FAILED /'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "ROOT_PASS="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya root@system.com ya STAGING - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "ROOT_PASS=%%p"
if not defined ROOT_PASS (
  echo ---PASSWORD-HAIKUANDIKWA: hakuna kilichotumwa--- >> %L%
  set STEP=PASSWORD-HAIKUANDIKWA
  set RC=1
  goto fail
)
set STEP=ENV-2.2.70-SALAMA-KURUDIWA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && N=$(grep -c '^BACKEND_VERSION=' .env); if [ x$N = x1 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env && [ ! -e .env.bak.kabla-ya-jaribio-2270 ]; then cp -p .env .env.bak.kabla-ya-jaribio-2270 && sed -i 's/^BACKEND_VERSION=.*/BACKEND_VERSION=2.2.70/' .env && echo RB_MPYA; elif [ x$N = x1 ] && grep -qx 'BACKEND_VERSION=2.2.70' .env && [ -f .env.bak.kabla-ya-jaribio-2270 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env.bak.kabla-ya-jaribio-2270; then echo RB_RUDIA; else echo RB_KATAA; false; fi; R=$?; X=$(diff .env.bak.kabla-ya-jaribio-2270 .env 2>/dev/null | grep '^[<>]' | grep -vc '^[<>] BACKEND_VERSION='); echo mistari isiyo ya toleo inayotofautiana $X; [ $R = 0 ] && [ x$X = x0 ] && grep -qx 'BACKEND_VERSION=2.2.70' .env && echo RB_ENV_2270_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\50-staging-rollback-2270.log" RB_ENV_2270_SAWA
if not defined NIMEPATA (
  echo SIYO: .env ya staging haikuwekwa 2.2.70 kwa usalama >> %L%
  set RC=1
  goto fail
)
set STEP=WASHA-2.2.70-JUU-YA-V134
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging up -d --no-deps --force-recreate --pull never backend; C=$(docker compose -p lsms-staging ps -aq backend) && for i in $(seq 1 100); do L=$(docker logs $C 2>&1); echo $L | grep -q -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed' && break; [ $(docker inspect --format '{{.RestartCount}}' $C) -gt 0 ] && break; sleep 3; done; docker inspect --format 'hali {{.State.Status}} restarts {{.RestartCount}} image {{.Config.Image}}' $C; docker logs $C 2>&1 | grep -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed|FlywayException|Validate failed|ERROR' | head -12 | cut -c1-300; docker logs $C 2>&1 | grep -q 'Started LsmsApplication' && docker inspect --format '{{.Config.Image}}' $C | grep -qx 'chiefmaster/my-lsms-backend:2.2.70' && echo ROLLBACK_2270_IMEWAKA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
set "IMEWAKA="
set "NIMEPATA="
call :mstari_pekee "analysis\steps\50-staging-rollback-2270.log" ROLLBACK_2270_IMEWAKA
if defined NIMEPATA set "IMEWAKA=1"
set "NODE_RC=SKIP"
if not defined IMEWAKA echo ROLLBACK_2270_IMEKATAA - 2.2.70 haikuwaka juu ya V134 >> %L%
if defined IMEWAKA (
  echo ---SALE-YA-CASH-CHINI-YA-2.2.70--- >> %L%
  set TARGET=staging
  set API=http://localhost:8081
  node analysis\steps\50-rollback-sale.mjs >> %L% 2>&1
)
if defined IMEWAKA set "NODE_RC=%errorlevel%"
echo [exit %NODE_RC%] >> %L%
set ROOT_PASS=
set STEP=FLYWAY-BAADA-LAZIMA-SAWA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -c 'select count(*) || chr(124) || max(installed_rank) || chr(124) || count(*) filter (where not success) from flyway_schema_history' > /tmp/50-flyway-baada.txt; sed 's/^/FLYWAY_SAFU_RANK_FAILED /' /tmp/50-flyway-baada.txt; cmp -s /tmp/50-flyway-kabla.txt /tmp/50-flyway-baada.txt && echo FLYWAY_HAIJABADILIKA; rm -f /tmp/50-flyway-kabla.txt /tmp/50-flyway-baada.txt; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
set STEP=RUDI-2.2.71
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && cp -p .env.bak.kabla-ya-jaribio-2270 .env && grep -qx 'BACKEND_VERSION=2.2.71' .env && docker compose -p lsms-staging up -d --no-deps --force-recreate --pull never backend && C=$(docker compose -p lsms-staging ps -aq backend) && for i in $(seq 1 100); do L=$(docker logs $C 2>&1); echo $L | grep -q -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed' && break; [ $(docker inspect --format '{{.RestartCount}}' $C) -gt 0 ] && break; sleep 3; done; docker inspect --format 'hali {{.State.Status}} restarts {{.RestartCount}} image {{.Config.Image}}' $C; docker logs $C 2>&1 | grep -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed|FlywayException|Validate failed|ERROR' | head -12 | cut -c1-300; docker logs $C 2>&1 | grep -q 'Started LsmsApplication' && docker inspect --format '{{.Config.Image}}' $C | grep -qx 'chiefmaster/my-lsms-backend:2.2.71' && echo STAGING_IMERUDI_2271 && rm -f .env.bak.kabla-ya-jaribio-2270 && echo backup ya jaribio imefutwa; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-BAADA-2.2.71
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && echo TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9') && [ $(grep -c '^BACKEND_VERSION=' .env) = 1 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\50-staging-rollback-2270.log" TOLEO_ENV_2271
if not defined NIMEPATA (
  echo SIYO: ishara TOLEO_ENV_2271 haipo - .env ya staging si toleo 2.2.71 >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\50-staging-rollback-2270.log" STAGING_IMERUDI_2271
if not defined NIMEPATA (
  echo SIYO: staging haikurudi 2.2.71 - SIMAMA, niambie >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\50-staging-rollback-2270.log" ROLLBACK_2270_IMEWAKA
if not defined NIMEPATA (
  echo SIYO: 2.2.70 HAIWAKI juu ya V134 - rollback ya image haitoshi; niambie - njia ni restore ya dump >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\50-staging-rollback-2270.log" FLYWAY_HAIJABADILIKA
if not defined NIMEPATA (
  echo SIYO: flyway_schema_history ilibadilika wakati wa 2.2.70 >> %L%
  set RC=1
  goto fail
)
if not "%NODE_RC%"=="0" (
  echo SIYO: sale ya cash chini ya 2.2.70 haikupata journal - exit %NODE_RC% >> %L%
  set STEP=SALE-CHINI-YA-2.2.70
  set RC=1
  goto fail
)
set STEP=PROD-PS
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - 2.2.70 inawaka juu ya V134, sale ya cash inapata journal, Flyway haibadiliki; staging imerudi 2.2.71. Rollback ya image ni salama. Matokeo: %L%.
goto end
:fail
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && if [ -f .env.bak.kabla-ya-jaribio-2270 ]; then cp -p .env.bak.kabla-ya-jaribio-2270 .env && docker compose -p lsms-staging up -d --no-deps --force-recreate --pull never backend && echo env imerudishwa kutoka backup; fi; } 2>&1 | awk %F%" >> %L% 2>&1
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Kama staging haikurudi 2.2.71, niambie mara moja.
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
