@echo off
rem HATUA 40 - JARIBIO LA TOLEO 1 KWENYE STAGING, AWAMU B. INAANDIKA KWENYE STAGING TU (kupitia API ya 2.2.71).
rem Awamu B: 1.g marekebisho HALISI ya journals za variance (kwenye staging), kisha dryRun ya pili lazima iwe 0, mizania na TB;
rem          1.f reopen ya reco ya mwisho iliyoidhinishwa (inabaki REOPENED kwenye staging) -> journal yake ya variance inageuzwa;
rem          kufunga miezi Jan-Sep 2026; 1.j journal ya mkono ya 20/09 inakataliwa, reopen Sep, journal ya 1 TZS na ya kuirudisha,
rem          funga tena, audit CLOSE,REOPEN,CLOSE; 1.i reopen ya reco ya Septemba (inabaki REOPENED kwenye staging) ->
rem          reversal ya variance yake inaandikwa 01/10 na tarehe ya tukio ya Septemba (imechelewa).
rem Endesha baada ya 39 kuwa ---OK--- na wewe kusoma orodha ya dryRun.
rem Production (~/lsms-deployment) HAIGUSWI - ps tu, kabla na baada. Kila output ya Contabo inapita ficha.awk.
rem Lazima kwanza: dirisha jingine lenye analysis\steps\tunnel.cmd likiwa wazi (localhost:8081 -> staging).
rem Password: inaulizwa kwa PowerShell Read-Host -AsSecureString - herufi hazionekani (* tu), haiandikwi kwenye log
rem   wala faili lolote, inafutwa kwenye variable mwishoni. Ni password ya root@system.com ya STAGING, ambayo ni
rem   ya PROD wakati wa dump: staging inarejeshwa kutoka dump ya prod. Dump ya 20/10 02:00 ni KABLA password ya root
rem   ya PROD haijabadilishwa 20/10, kwa hiyo staging ya sasa ina password ya ZAMANI; staging ikirejeshwa tena kutoka
rem   dump ya baadaye itakuwa na password MPYA ya prod.
rem Matokeo: analysis\steps\40-toleo1-jaribu-b.log   (tafuta FAIL; mstari wa MUHTASARI unaonyesha PASS/FAIL/SKIP)
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set "L=analysis\steps\40-toleo1-jaribu-b.log"
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
echo ---MWENDESHO-40--- > %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
if errorlevel 1 goto fail
echo ---STAGING-LAZIMA-2.2.71--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && echo TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9') && [ $(grep -c '^BACKEND_VERSION=' .env) = 1 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env; } 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\40-toleo1-jaribu-b.log" TOLEO_ENV_2271
if not defined NIMEPATA (
  echo SIYO: ishara TOLEO_ENV_2271 haipo - .env ya staging si toleo 2.2.71 >> %L%
  set RC=1
  goto fail
)
echo ---PROD-PS-KABLA--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}' 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> %L% 2>&1
if errorlevel 1 goto fail
echo ---STAGING-KABLA-READ-ONLY--- >> %L%
ssh %SSHO% contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1; } 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" < analysis\steps\39-toleo1-kabla.sql > analysis\steps\39-toleo1-data.txt 2>&1
set RC=%errorlevel%
type analysis\steps\39-toleo1-data.txt >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"FLYWAY_YA_MWISHO|134" analysis\steps\39-toleo1-data.txt > nul
if errorlevel 1 goto fail
findstr /b /l /c:"T1DATA|" analysis\steps\39-toleo1-data.txt > nul
if errorlevel 1 goto fail
echo ---TUNNEL-LAZIMA-400--- >> %L%
curl -s -o nul -w "%%{http_code}" -X POST -H "Content-Type: application/json" -d "{}" http://localhost:8081/api/auth/login > analysis\steps\40-tunnel.txt 2>&1
type analysis\steps\40-tunnel.txt >> %L%
echo. >> %L%
set "NIMEPATA="
call :mstari_pekee "analysis\steps\40-tunnel.txt" 400
if not defined NIMEPATA (
  echo SIYO: tunnel haijibu 400 - fungua analysis\steps\tunnel.cmd kwenye dirisha jingine >> %L%
  goto fail
)
set "ROOT_PASS="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya root@system.com ya STAGING - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "ROOT_PASS=%%p"
if not defined ROOT_PASS (
  echo ---PASSWORD-HAIKUANDIKWA: hakuna kilichotumwa--- >> %L%
  set STEP=PASSWORD-HAIKUANDIKWA
  set RC=1
  goto fail
)
echo ---NODE-AWAMU-B--- >> %L%
node analysis\steps\39-toleo1-jaribu.mjs B >> %L% 2>&1
set NODE_RC=%errorlevel%
set ROOT_PASS=
echo ---STAGING-BAADA-READ-ONLY--- >> %L%
ssh %SSHO% contabo "set -o pipefail; cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" < analysis\steps\39-toleo1-baada.sql >> %L% 2>&1
echo ---STAGING-LOG-YA-GL--- >> %L%
ssh %SSHO% -n contabo "cd ~/lsms-staging && docker compose -p lsms-staging logs --no-color --since 30m backend 2>&1 | grep -E -A2 'GL posting failure recorded|GL postSale failed|GL post failed|closed period|Day-close variance correction| ERROR ' | tail -60 | cut -c1-400 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---PROD-PS-BAADA--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}' 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> %L% 2>&1
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
if not "%NODE_RC%"=="0" goto failnode
echo ---OK--- >> %L%
echo OK - Awamu B ya Toleo 1 imepita kwenye staging. Matokeo: %L%. Sasa unaweza kuendesha 41.
goto end
:failnode
echo ---IMESHINDWA-JARIBIO-FAIL--- >> %L%
echo Kuna FAIL - soma %L%
goto end
:fail
set ROOT_PASS=
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA - soma %L%
:end
set ROOT_PASS=
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
