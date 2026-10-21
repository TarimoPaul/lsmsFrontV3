@echo off
rem HATUA 45h - V3 3.1.11 KWENYE PROD (baada ya backend 2.2.71 na 45g, kabla ya 46). Inagusa frontend-v3 tu (Flutter na /api hazigusi).
rem   Mantiki ileile ya deploy\deploy-v3.ps1 -DeployOnly 3.1.11: SERVER (nyuma) inaendesha deploy\remote-deploy-v3.sh 3.1.11 bila
rem   kubadilishwa (pull, .env, compose up frontend-v3, health check, rollback yenyewe); baada ya DEPLOY_OK PC inaandika
rem   .frontend-v3-version = 3.1.11 na commit. Image: digest ya 37v-thibitisha (inalinganishwa baadaye).
rem   Kabla ya kuanza tu: V3 ya prod bado si 3.1.11 (remote-deploy-v3.sh haikatai toleo lilelile).
rem KUKATIKA KWA UMEME/MTANDAO (mmiliki 21/10): sehemu ya Contabo inaendeshwa NYUMA kwenye server (45-bg.sh: setsid + nohup,
rem   log ~/lsms-hatua/^<kazi^>/log) - ssh ikikatika kazi ya server inaendelea hadi mwisho wake, pamoja na rollback yake.
rem   PC inafuatilia kila sek 10. Ukikatika: endesha hatua hii TENA - inagundua kazi imefika wapi: haijaanza = inaanza
rem   (pamoja na kinga zote); inaendesha = inafuatilia tu; imeisha = inasoma log na kumaliza. Kazi HAIANZI mara mbili.
rem   IMEKUFA (hakuna mwisho na mchakato haupo, mf. server ilizimwa) = SIMAMA, niambie. Log ya jaribio lililopita: ^<log^>.awali
rem Kinga: inakataa kuanza ikiwa log ya 45g au ya 38e (V3 kwenye staging) haiishii ---OK---.
rem Matokeo: analysis\steps\45h-prod-v3-3111.log
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
set L=analysis\steps\45h-prod-v3-3111.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-45h--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\45g-prod-b2-c-d.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 45g haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 45g haikuisha na ---OK---. Soma analysis\steps\45g-prod-b2-c-d.log na umalize 45g kwanza. 45h haijaendeshwa.
  goto end
)
set "NIMEPATA="
call :mwisho_ni "analysis\steps\38e-staging-v3-3111.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 38e haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 38e haikuisha na ---OK---. Soma analysis\steps\38e-staging-v3-3111.log na umalize 38e kwanza. 45h haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "V3D="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$m = @(Select-String -LiteralPath 'analysis\steps\37v-thibitisha-3111.log' -CaseSensitive -Pattern '^V3_DIGEST (\S+)\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); if ($m.Count -eq 1 -and $m[0] -cmatch '^sha256:[0-9a-f]{64}$') { $m[0] } else { 'KOSA:' + ($m -join ',') }"`) do set "V3D=%%v"
if not defined V3D set "V3D=KOSA:"
echo V3_DIGEST kutoka 37v-thibitisha: %V3D% >> %L%
if "%V3D:~0,5%"=="KOSA:" (
  echo SIYO: V3_DIGEST kwenye analysis\steps\37v-thibitisha-3111.log haipo, si moja, au muundo wake si sahihi >> %L%
  set STEP=37V-THIBITISHA-V3-DIGEST
  set RC=1
  goto fail
)
set STEP=KIENDESHAJI-CHA-NYUMA-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { mkdir -p ~/lsms-hatua && echo lsms-hatua tayari; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
scp %SSHO% analysis\steps\45-bg.sh contabo:lsms-hatua/45-bg.sh >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "BGID=45h-v3-3.1.11"
set "BGH=analysis\steps\45h-v3-3.1.11-hali.txt"
call :bg_hali
echo hali ya kazi %BGID% kabla: %HALI% >> %L%
if "%HALI%"=="BG_HALI_INAENDESHA" echo KAZI %BGID% INAENDESHA TAYARI - inafuatiliwa tu, haianzi upya >> %L%
if "%HALI%"=="BG_HALI_INAENDESHA" goto bg_fuatilia
if "%HALI:~0,16%"=="BG_HALI_IMEISHA_" echo KAZI %BGID% ILISHAISHA - log yake inasomwa, haianzi upya >> %L%
if "%HALI:~0,16%"=="BG_HALI_IMEISHA_" goto bg_matokeo
if not "%HALI%"=="BG_HALI_HAKUNA" (
  echo SIYO: hali ya kazi ni %HALI% - SIMAMA, niambie. Usiendeshe kazi upya >> %L%
  set STEP=BG-HALI-%HALI%
  set RC=1
  goto fail
)
echo KAZI %BGID% HAIJAANZA - kinga za kuanza zinafuata >> %L%
set STEP=V3-PROD-BADO-SI-3.1.11
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && I=$(docker compose ps frontend-v3 --format '{{.Image}}') && echo frontend-v3 $I && [ x$I != xchiefmaster/lsms-frontend-v3:3.1.11 ] && echo V3_BADO_SI_3111; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45h-prod-v3-3111.log" V3_BADO_SI_3111
if not defined NIMEPATA (
  echo SIYO: V3 ya prod tayari ni 3.1.11 bila kazi ya 45h - niambie >> %L%
  set RC=1
  goto fail
)
set STEP=KAZI-INAANZA-KWENYE-SERVER
echo ---%STEP%--- >> %L%
scp %SSHO% "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\deploy\remote-deploy-v3.sh" contabo:/tmp/lsms-bg-%BGID%.sh >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
ssh %SSHO% -n contabo "bash ~/lsms-hatua/45-bg.sh anza %BGID% /tmp/lsms-bg-%BGID%.sh 3.1.11 2>&1 | awk %F%; rm -f /tmp/lsms-bg-%BGID%.sh" > %BGH% 2>&1
type %BGH% >> %L%
findstr /b /l /c:"BG_IMEANZA" /c:"BG_IPO" %BGH% > nul
if errorlevel 1 (
  echo SIYO: kazi haikuanza - hakuna BG_IMEANZA >> %L%
  set RC=1
  goto fail
)
:bg_fuatilia
set STEP=BG-INAFUATILIWA
echo ---%STEP%--- >> %L%
set "BGN=0"
set "BGE=0"
:bg_zunguka
ping -n 11 127.0.0.1 > nul
call :bg_hali
if "%HALI%"=="HAKUNA_JIBU" set /a BGE+=1
if "%HALI%"=="HAKUNA_JIBU" echo   Contabo haijibu kwa ssh - jaribio %BGE% ya 30. Kazi ya server inaendelea yenyewe.
if "%HALI%"=="HAKUNA_JIBU" if %BGE% GEQ 30 goto bg_haijibu
if "%HALI%"=="HAKUNA_JIBU" goto bg_zunguka
set "BGE=0"
if "%HALI%"=="BG_HALI_INAENDESHA" set /a BGN+=1
if "%HALI%"=="BG_HALI_INAENDESHA" echo   inaendesha kwenye server - ukaguzi %BGN% - kila sek 10. Usifunge dirisha hili.
if "%HALI%"=="BG_HALI_INAENDESHA" if %BGN% GEQ 90 goto bg_muda
if "%HALI%"=="BG_HALI_INAENDESHA" goto bg_zunguka
if "%HALI:~0,16%"=="BG_HALI_IMEISHA_" goto bg_matokeo
echo SIYO: hali ya kazi %BGID% ni %HALI% - SIMAMA, niambie. Usiendeshe kazi upya >> %L%
set STEP=BG-%HALI%
set RC=1
goto fail
:bg_haijibu
echo SIYO: Contabo haikujibu ssh mara 30 mfululizo. Kazi ya server INAENDELEA YENYEWE - endesha hatua hii tena ukipata mtandao >> %L%
set STEP=SSH-HAIJIBU-ENDESHA-TENA
set RC=1
goto fail
:bg_muda
echo SIYO: kazi bado inaendesha baada ya dakika 15 - endesha hatua hii tena kuifuatilia >> %L%
set STEP=BADO-INAENDESHA-ENDESHA-TENA
set RC=1
goto fail
:bg_matokeo
set STEP=BG-LOG-YA-SERVER
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "bash ~/lsms-hatua/45-bg.sh log %BGID% 2>&1 | awk %F%" >> %L% 2>&1
echo hali ya mwisho ya kazi %BGID%: %HALI% >> %L%
if not "%HALI%"=="BG_HALI_IMEISHA_0" (
  echo SIYO: script ya server iliisha na %HALI% - soma mistari ya server hapo juu; rollback ni ya script yenyewe >> %L%
  set RC=1
  goto fail
)
findstr /b /l /c:"DEPLOY_OK 3.1.11" %L% > nul
if errorlevel 1 (
  echo SIYO: log ya server haina DEPLOY_OK 3.1.11 >> %L%
  set RC=1
  goto fail
)
set STEP=FAILI-LA-TOLEO-V3
echo ---%STEP%--- >> %L%
powershell -NoProfile -ExecutionPolicy Bypass -File analysis\steps\45-toleo-faili.ps1 -Kind v3 -Version 3.1.11 >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
set STEP=PROD-V3-DIGEST-NA-TOLEO
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && C=$(docker compose ps -q frontend-v3) && echo frontend-v3 $(docker inspect --format '{{.Config.Image}}' $C) && docker image inspect --format '{{range .RepoDigests}}{{println .}}{{end}}' $(docker inspect --format '{{.Image}}' $C) | grep -qx 'chiefmaster/lsms-frontend-v3@%V3D%' && echo PROD_V3_DIGEST_SAWA; curl -s -m 15 https://elikom.co.tz/v3/version.json | head -c 200; echo; curl -s -m 15 https://elikom.co.tz/v3/version.json | grep -qF 3.1.11 && echo PROD_V3_3111_INAJIBU; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45h-prod-v3-3111.log" PROD_V3_DIGEST_SAWA
if not defined NIMEPATA (
  echo SIYO: V3 ya prod si image ya 37v >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45h-prod-v3-3111.log" PROD_V3_3111_INAJIBU
if not defined NIMEPATA (
  echo SIYO: https://elikom.co.tz/v3/ haijibu 3.1.11 >> %L%
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - V3 3.1.11 iko prod (digest ya staging). Matokeo: %L%. Sasa unaweza kuendesha 46a.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Ikiwa ni muunganiko: endesha 45h TENA - itafuatilia kazi ileile. Vinginevyo nitumie log.
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
:bg_hali
set "HALI=HAKUNA_JIBU"
ssh %SSHO% -n contabo "bash ~/lsms-hatua/45-bg.sh hali %BGID% 2>&1 | awk %F%" > %BGH% 2>&1
for /f "usebackq tokens=1" %%h in (`findstr /b /c:"BG_HALI_" %BGH%`) do set "HALI=%%h"
goto :eof
