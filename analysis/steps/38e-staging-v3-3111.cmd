@echo off
rem HATUA 38e - INABADILISHA STAGING TU: V3 ya staging -^> 3.1.11 (image ileile ya 37v, digest ya 37v-thibitisha inalinganishwa).
rem   Staging iliendesha V3 3.0.1 (38c): 3.1.11 haikuwahi kujaribiwa na backend 2.2.71. Production HAIGUSWI (ps tu).
rem   Salama kurudiwa: .env bila backup -^> backup .env.bak.kabla-ya-v3-3111 + FRONTEND_V3_VERSION=3.1.11 (V3_MPYA); .env tayari 3.1.11
rem   na backup ipo -^> haiguswi (V3_RUDIA); hali nyingine -^> V3_KATAA. Tofauti na backup lazima iwe mstari wa V3 tu.
rem   Kisha: /v3/version.json ya staging = 3.1.11, /v3/ 200, API ya staging bado 400.
rem Baada ya OK: fungua http://localhost:8081/v3/ (tunnel.cmd), ingia, uone kadi ya Makosa ya GL na tab ya Vipindi.
rem Kinga: inakataa kuanza ikiwa log ya 37v-thibitisha haiishii ---OK---.
rem Matokeo: analysis\steps\38e-staging-v3-3111.log
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
set L=analysis\steps\38e-staging-v3-3111.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-38e--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\37v-thibitisha-3111.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 37v-thibitisha haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 37v-thibitisha haikuisha na ---OK---. Soma analysis\steps\37v-thibitisha-3111.log na umalize 37v-thibitisha kwanza. 38e haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "V3D="
for /f "tokens=2" %%d in ('findstr /b /l /c:"V3_DIGEST " analysis\steps\37v-thibitisha-3111.log') do set "V3D=%%d"
echo digest ya V3 3.1.11 kutoka 37v-thibitisha: %V3D% >> %L%
if not "%V3D:~0,7%"=="sha256:" (
  echo SIYO: log ya 37v-thibitisha haina V3_DIGEST sha256:... >> %L%
  set STEP=V3-DIGEST
  set RC=1
  goto fail
)
set STEP=STAGING-V3-HALI-KABLA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging; echo env TOLEO_V3_$(grep '^FRONTEND_V3_VERSION=' .env | cut -d= -f2 | tr -dc '0-9'); echo mistari ya V3 kwenye env $(grep -c '^FRONTEND_V3_VERSION=' .env); docker compose -p lsms-staging ps --format '{{.Service}} {{.Image}} {{.Status}}' frontend-v3; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
set STEP=STAGING-V3-ENV-3.1.11-SALAMA-KURUDIWA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && N=$(grep -c '^FRONTEND_V3_VERSION=' .env); if [ x$N = x1 ] && ! grep -qx 'FRONTEND_V3_VERSION=3.1.11' .env && [ ! -e .env.bak.kabla-ya-v3-3111 ]; then cp -p .env .env.bak.kabla-ya-v3-3111 && sed -i 's/^FRONTEND_V3_VERSION=.*/FRONTEND_V3_VERSION=3.1.11/' .env && echo V3_MPYA; elif [ x$N = x1 ] && grep -qx 'FRONTEND_V3_VERSION=3.1.11' .env && [ -f .env.bak.kabla-ya-v3-3111 ] && ! grep -qx 'FRONTEND_V3_VERSION=3.1.11' .env.bak.kabla-ya-v3-3111; then echo V3_RUDIA; else echo V3_KATAA; false; fi; R=$?; X=$(diff .env.bak.kabla-ya-v3-3111 .env 2>/dev/null | grep '^[<>]' | grep -vc '^[<>] FRONTEND_V3_VERSION='); echo mistari isiyo ya V3 inayotofautiana $X; [ $R = 0 ] && [ x$X = x0 ] && grep -qx 'FRONTEND_V3_VERSION=3.1.11' .env && echo V3_ENV_3111_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\38e-staging-v3-3111.log" V3_ENV_3111_SAWA
if not defined NIMEPATA (
  echo SIYO: .env ya staging si 3.1.11 au mstari mwingine umebadilika >> %L%
  set RC=1
  goto fail
)
set STEP=STAGING-V3-PULL-NA-WASHA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging pull -q frontend-v3 && docker compose -p lsms-staging up -d --no-deps frontend-v3 && C=$(docker compose -p lsms-staging ps -q frontend-v3) && for i in $(seq 1 40); do H=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $C); [ $H = healthy ] && break; sleep 3; done; echo frontend-v3 $H $(docker inspect --format '{{.Config.Image}}' $C) && docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' $(docker inspect --format '{{.Image}}' $C) | grep -qx 'chiefmaster/lsms-frontend-v3@%V3D%' && echo STAGING_V3_DIGEST_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-V3-HTTP
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { curl -s -m 10 http://127.0.0.1:8081/v3/version.json | head -c 200; echo; C=$(curl -s -o /dev/null -m 10 -w '%%{http_code}' http://127.0.0.1:8081/v3/ | tr -dc '0-9'); echo v3 HTTP_$C; A=$(curl -s -o /dev/null -m 10 -w '%%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:8081/api/auth/login | tr -dc '0-9'); echo api HTTP_$A; curl -s -m 10 http://127.0.0.1:8081/v3/version.json | grep -qF 3.1.11 && [ x$C = x200 ] && [ x$A = x400 ] && echo STAGING_V3_3111_INAJIBU; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\38e-staging-v3-3111.log" STAGING_V3_DIGEST_SAWA
if not defined NIMEPATA (
  echo SIYO: V3 ya staging si image ya 37v >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\38e-staging-v3-3111.log" STAGING_V3_3111_INAJIBU
if not defined NIMEPATA (
  echo SIYO: /v3/ ya staging si 3.1.11 au haijibu >> %L%
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
echo OK - V3 3.1.11 inaendesha kwenye staging (digest ya 37v). Matokeo: %L%. Fungua http://localhost:8081/v3/ uone kadi ya Makosa ya GL na tab ya Vipindi; kisha 50.
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
