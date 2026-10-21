@echo off
rem HATUA 49 - HATUA YA MMILIKI: KUSIMAMISHA STAGING baada ya §1.8 (docker compose -p lsms-staging stop). STAGING TU.
rem   Containers zinasimama (hazifutwi); data na images zinabaki. Kuwasha tena: 36-1-staging-washa.cmd (au up -d).
rem   Prod (~/lsms-deployment) inasomwa tu, kabla na baada, na lazima iwe sawa.
rem Kinga: inakataa kuanza ikiwa log ya 47 haiishii ---OK---.
rem Matokeo: analysis\steps\49-staging-simamisha.log
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
set L=analysis\steps\49-staging-simamisha.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-49--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\47-prod-funga-jan-sep.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 47 haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 47 haikuisha na ---OK---. Soma analysis\steps\47-prod-funga-jan-sep.log na umalize 47 kwanza. 49 haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PROD-NA-STAGING-KABLA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format '{{.Service}} {{.Image}} {{.State}}' | sort > /tmp/49-prod-kabla.txt && cat /tmp/49-prod-kabla.txt && cd ~/lsms-staging && docker compose -p lsms-staging ps -a --format 'table {{.Service}} {{.Image}} {{.Status}}' && echo env ya staging TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9'); } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=STAGING-SIMAMISHA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging stop && docker compose -p lsms-staging ps -a --format '{{.Service}} {{.State}}' && N=$(docker compose -p lsms-staging ps -q --status running | wc -l) && echo zinazoendesha $N && [ x$N = x0 ] && echo STAGING_IMESIMAMA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PROD-BAADA-LAZIMA-SAWA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format '{{.Service}} {{.Image}} {{.State}}' | sort > /tmp/49-prod-baada.txt && cat /tmp/49-prod-baada.txt && cmp /tmp/49-prod-kabla.txt /tmp/49-prod-baada.txt && echo PROD_HAIJABADILIKA; rm -f /tmp/49-prod-kabla.txt /tmp/49-prod-baada.txt; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\49-staging-simamisha.log" STAGING_IMESIMAMA
if not defined NIMEPATA (
  echo SIYO: staging bado ina container zinazoendesha >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\49-staging-simamisha.log" PROD_HAIJABADILIKA
if not defined NIMEPATA (
  echo SIYO: prod imebadilika >> %L%
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - staging imesimamishwa; prod haijabadilika. Matokeo: %L%.
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
