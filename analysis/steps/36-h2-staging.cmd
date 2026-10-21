@echo off
rem HATUA 36 - JARIBIO LA H-2 KWENYE STAGING. INAANDIKA KWENYE STAGING TU: sales 4 za jaribio (sale_notes "QA-H2 ...",
rem bidhaa 1, jumla ya vipande 6). Production (~/lsms-deployment) HAIGUSWI - inasomwa tu (docker compose ps) kabla na baada.
rem Lazima kwanza: dirisha jingine lenye analysis\steps\tunnel.cmd likiwa wazi (localhost:8081 -> staging).
rem Itakuuliza password ya root@system.com ya STAGING; haiandikwi kwenye faili lolote.
rem Endesha 36-0-staging-db.cmd kwanza: inathibitisha (kusoma tu) kwamba postgres ya staging inaendesha.
rem
rem Dhana inayojaribiwa (RIPOTI H-2): postSale (async) inasoma entity ya Sales ambayo outstandingBalance bado ni 0,
rem kwa sababu syncPaymentStatusByUid ni UPDATE ya SQL (DB tu, si entity). Kwa sale yenye deni mstari wa AR unakosekana,
rem journal haiko balanced, executePost inaikataa, na SaleService inaandika log tu.
rem Utabiri:  A (cash yote) = journal SALE_CASH ipo.  B, C, D (zenye deni) = HAKUNA journal, na log ya backend:
rem           "GL postSale failed for <risiti>: GL post failed for SALE_CASH ref=<uid>"  (SALE_CASH ingawa ina deni).
rem
rem 0) kichujio cha siri kwenda /tmp ya Contabo (kinafutwa mwishoni)
rem 1) toleo la backend la staging na prod ps (kabla); staging ps -a (hali ya containers, pamoja na zilizosimama)
rem 2) 36-h2-kabla.sql kwenye DB ya STAGING (READ ONLY): Flyway, gl_config, bidhaa na mteja -> analysis\steps\36-h2-data.txt
rem 3) tunnel inajibu? (POST /api/auth/login tupu lazima irudishe 400)
rem 4) node 36-h2-staging.mjs: inaunda sales 4 kupitia /api/v1/sales/partial
rem 5) 36-h2-baada.sql kwenye DB ya STAGING (READ ONLY): journals za sales hizo
rem 6) log ya backend ya staging: GL postSale failed / Unbalanced journal
rem 7) staging ps na prod ps (baada) - prod lazima isibadilike
rem Kila sehemu inaandika [exit N] kwenye log; stdout NA stderr ya kila amri ya Contabo zinaingia kwenye log (kupitia ficha.awk).
rem Matokeo: analysis\steps\36-h2-staging.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\36-h2-staging.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set STEP=
echo ---MWENDESHO-36--- > %L%

set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail

set STEP=STAGING-TOLEO
echo ---%STEP%--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-staging && grep '^BACKEND_VERSION=' .env | cut -d= -f2 | sed 's/^/staging backend: /'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail

set STEP=PROD-PS-KABLA
echo ---%STEP%--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail

set STEP=STAGING-PS-KABLA
echo ---%STEP%--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging ps -a --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail

set STEP=STAGING-KABLA-READ-ONLY
echo ---%STEP%--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1; } 2>&1 | awk %F%" < analysis\steps\36-h2-kabla.sql > analysis\steps\36-h2-data.txt 2>&1
set RC=%errorlevel%
rem Faili la data linaingia kwenye log KABLA ya kuamua kama imeshindwa, ili kosa lionekane.
type analysis\steps\36-h2-data.txt >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"H2DATA|" analysis\steps\36-h2-data.txt > nul
if errorlevel 1 (
  echo SIYO: hakuna mstari H2DATA - bidhaa yenye stock ^>= 20 na bei ^> gharama haikupatikana >> %L%
  goto fail
)
findstr /b /l /c:"H2CUST|" analysis\steps\36-h2-data.txt > nul
if errorlevel 1 (
  echo SIYO: hakuna mstari H2CUST - mteja wa REGULAR hakupatikana >> %L%
  goto fail
)
findstr /b /l /c:"GL_CONFIG|posting_enabled=true" analysis\steps\36-h2-data.txt > nul
if errorlevel 1 (
  echo SIYO: GL_CONFIG si posting_enabled=true >> %L%
  goto fail
)

set STEP=TUNNEL-LAZIMA-400
echo ---%STEP%--- >> %L%
curl -s -o nul -w "%%{http_code}" -X POST -H "Content-Type: application/json" -d "{}" http://localhost:8081/api/auth/login > analysis\steps\36-h2-tunnel.txt 2>&1
set RC=%errorlevel%
type analysis\steps\36-h2-tunnel.txt >> %L%
echo. >> %L%
echo [exit %RC%] >> %L%
set "NIMEPATA="
call :mstari_pekee "analysis\steps\36-h2-tunnel.txt" 400
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
set STEP=NODE-SALES-4
echo ---%STEP%--- >> %L%
node analysis\steps\36-h2-staging.mjs >> %L% 2>&1
set RC=%errorlevel%
set ROOT_PASS=
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail

set STEP=STAGING-BAADA-READ-ONLY
echo ---%STEP%--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1; } 2>&1 | awk %F%" < analysis\steps\36-h2-baada.sql >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail

set STEP=STAGING-LOG-YA-GL
echo ---%STEP%--- >> %L%
ssh contabo "{ cd ~/lsms-staging && docker compose -p lsms-staging logs --no-color --since 30m backend; } 2>&1 | grep -E -A3 'GL postSale failed|GL post failed|GL shadow post failed|Unbalanced journal|LazyInitialization' | tail -60 | cut -c1-400 | awk %F%" >> %L% 2>&1
echo [exit %errorlevel%] (grep bila mstari = 1, si kosa) >> %L%

set STEP=STAGING-PS
echo ---%STEP%--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
echo [exit %errorlevel%] >> %L%
set STEP=PROD-PS-BAADA
echo ---%STEP%--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
echo [exit %errorlevel%] >> %L%
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK. Matokeo: %L%
goto end
:fail
set ROOT_PASS=
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%
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
