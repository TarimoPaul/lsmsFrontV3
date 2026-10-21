@echo off
rem HATUA 38d - MUDA WA JIBU LA POS BAADA (backend 2.2.71 kwenye STAGING). INAANDIKA KWENYE STAGING TU: sales 22 za
rem jaribio (sale_notes "QA-MUDA baada ...", bidhaa 1, kipande 1 kila moja). Production (~/lsms-deployment) HAIGUSWI -
rem inasomwa tu (docker compose ps) kabla na baada.
rem Lazima kwanza: dirisha jingine lenye analysis\steps\tunnel.cmd likiwa wazi (localhost:8081 -> staging).
rem Password: inaulizwa kwa PowerShell Read-Host -AsSecureString - herufi hazionekani (* tu), haiandikwi kwenye log
rem   wala faili lolote, inafutwa kwenye variable mwishoni. Ni password ya root@system.com ya STAGING, ambayo ni
rem   ya PROD wakati wa dump: staging inarejeshwa kutoka dump ya prod. Dump ya 20/10 02:00 ni KABLA password ya root
rem   ya PROD haijabadilishwa 20/10, kwa hiyo staging ya sasa ina password ya ZAMANI; staging ikirejeshwa tena kutoka
rem   dump ya baadaye itakuwa na password MPYA ya prod.
rem Endesha baada ya 38c (staging 2.2.71) na KABLA ya 39. Linganisha na pos-muda-kabla.json (hatua 36b).
rem Kinga: inakataa kuanza ikiwa log ya 38c haiishii ---OK--- (kubandika amri nyingi pamoja hakuendeshi 38d baada ya 38c kushindwa).
rem
rem 0) kichujio cha siri kwenda /tmp ya Contabo (kinafutwa mwishoni)
rem 1) staging lazima iwe BACKEND_VERSION=2.2.71; prod ps (kabla)
rem 2) 36-h2-kabla.sql kwenye DB ya STAGING (READ ONLY): bidhaa na mteja -> analysis\steps\36-h2-data.txt
rem 3) tunnel inajibu? (POST /api/auth/login tupu lazima irudishe 400)
rem 4) node pos-muda.mjs baada: sales 2 za kupasha moto + 10 cash + 10 deni, muda wa kila jibu (ms)
rem 5) staging ps na prod ps (baada) - prod lazima isibadilike
rem Matokeo: analysis\steps\38d-pos-muda-baada.log na analysis\steps\pos-muda-baada.json
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\38d-pos-muda-baada.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
echo ---MWENDESHO-38d--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\38c-toleo1-staging-2271.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 38c haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 38c haikuisha na ---OK---. Soma analysis\steps\38c-toleo1-staging-2271.log na umalize 38c kwanza. 38d haijaendeshwa.
  goto end
)
echo ---KICHUJIO-KWENDA-CONTABO--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
if errorlevel 1 goto fail
echo ---STAGING-TOLEO-LAZIMA-2.2.71--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && echo TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9') && [ $(grep -c '^BACKEND_VERSION=' .env) = 1 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\38d-pos-muda-baada.log" TOLEO_ENV_2271
if not defined NIMEPATA (
  echo SIYO: ishara TOLEO_ENV_2271 haipo - .env ya staging si toleo 2.2.71 >> %L%
  set RC=1
  goto fail
)
echo ---PROD-PS-KABLA--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}' 2>&1 | awk %F%" >> %L% 2>&1
if errorlevel 1 goto fail
echo ---STAGING-DATA-READ-ONLY--- >> %L%
ssh %SSHO% contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1; } 2>&1 | awk %F%" < analysis\steps\36-h2-kabla.sql > analysis\steps\36-h2-data.txt 2>&1
set RC=%errorlevel%
type analysis\steps\36-h2-data.txt >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"H2DATA|" analysis\steps\36-h2-data.txt > nul
if errorlevel 1 goto fail
findstr /b /l /c:"H2CUST|" analysis\steps\36-h2-data.txt > nul
if errorlevel 1 goto fail
echo ---TUNNEL-LAZIMA-400--- >> %L%
curl -s -o nul -w "%%{http_code}" -X POST -H "Content-Type: application/json" -d "{}" http://localhost:8081/api/auth/login > analysis\steps\38d-pos-muda-baada-tunnel.txt 2>&1
type analysis\steps\38d-pos-muda-baada-tunnel.txt >> %L%
echo. >> %L%
set "NIMEPATA="
call :mstari_pekee "analysis\steps\38d-pos-muda-baada-tunnel.txt" 400
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
echo ---NODE-POS-MUDA--- >> %L%
node analysis\steps\pos-muda.mjs baada >> %L% 2>&1
set NODE_RC=%errorlevel%
set ROOT_PASS=
if not "%NODE_RC%"=="0" goto fail
echo ---STAGING-PS--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; cd ~/lsms-staging && docker compose -p lsms-staging ps --format 'table {{.Service}} {{.Image}} {{.Status}}' 2>&1 | awk %F%" >> %L% 2>&1
echo ---PROD-PS-BAADA--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}' 2>&1 | awk %F%" >> %L% 2>&1
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - muda wa jibu la POS baada ya 2.2.71 umepimwa kwenye staging. Matokeo: %L%. Sasa unaweza kuendesha 39.
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
