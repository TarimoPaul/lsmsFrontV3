@echo off
rem HATUA 45g = (b2) + (c) + (d) ya MPANGO 1.8. Baada ya (b): wewe umeondoa FINANCE_WRITE kwenye role Executive CEO (Roles UI).
rem   (b2) UKAGUZI: admin@admin.com ni INACTIVE (API, kwa root).
rem   (c) RESTART ya backend ya prod (cache ya users dakika 5 na ruhusa dakika 15 zinasafishwa) - /api chini ~65s.
rem   (d) THIBITISHA baada ya restart: password ya zamani ya root inakataliwa, mpya inaingia; admin@admin.com INACTIVE;
rem       jess@elikom.co.tz (Executive CEO) HANA FINANCE_WRITE; tarimo@gmail.com (CEO, mmiliki) ANAYO.
rem Inabadilisha prod kwa restart TU (hakuna mabadiliko ya data). Akaunti: root (b2 / d zinahitaji root).
rem Kinga: inakataa kuanza ikiwa log ya 45f haiishii ---OK---.
rem Matokeo: analysis\steps\45g-prod-b2-c-d.log
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
set L=analysis\steps\45g-prod-b2-c-d.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-45g--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\45f-prod-root-a.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 45f haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 45f haikuisha na ---OK---. Soma analysis\steps\45f-prod-root-a.log na umalize 45f kwanza. 45g haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
if not defined PROD_API set "PROD_API=https://elikom.co.tz"
echo PROD_API=%PROD_API% >> %L%
set "ROOT_PASS="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password MPYA ya root@system.com ya PROD - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "ROOT_PASS=%%p"
if not defined ROOT_PASS (
  echo ---PASSWORD-HAIKUANDIKWA: hakuna kilichotumwa--- >> %L%
  set STEP=PASSWORD-HAIKUANDIKWA
  set RC=1
  goto fail
)
set TARGET=prod
set STEP=B2-ADMIN-INACTIVE
echo ---%STEP%--- >> %L%
node analysis\steps\45-root-ukaguzi.mjs b2 >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=C-RESTART-BACKEND-YA-PROD
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && S=$(date -u +%%Y-%%m-%%dT%%H:%%M:%%SZ) && docker compose restart backend && for i in $(seq 1 60); do docker compose logs --no-color --since $S backend 2>&1 | grep -q -E 'Started LsmsApplication|APPLICATION FAILED' && break; sleep 3; done; docker compose logs --no-color --since $S backend 2>&1 | grep -E 'Started LsmsApplication|APPLICATION FAILED' | tail -2 | cut -c1-300; docker compose logs --no-color --since $S backend 2>&1 | grep -q 'Started LsmsApplication' && echo PROD_RESTART_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45g-prod-b2-c-d.log" PROD_RESTART_SAWA
if not defined NIMEPATA (
  echo SIYO: backend haikuwaka baada ya restart - SIMAMA >> %L%
  set RC=1
  goto fail
)
set STEP=PROD-PUBLIC-API-400
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { for i in $(seq 1 20); do C=$(curl -s -o /dev/null -m 10 -w '%%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' https://elikom.co.tz/api/auth/login | tr -dc '0-9'); [ x$C = x400 ] && break; sleep 3; done; echo HTTP_$C; [ x$C = x400 ] && echo PUBLIC_API_400; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=D-THIBITISHA
echo ---%STEP%--- >> %L%
node analysis\steps\45-root-ukaguzi.mjs d >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - (b2) admin INACTIVE, (c) restart, (d) root mpya / ya zamani inakataliwa, Executive CEO hana FINANCE_WRITE, CEO anayo. Matokeo: %L%. Sasa unaweza kuendesha 45h (V3 3.1.11).
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Nitumie log.
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
