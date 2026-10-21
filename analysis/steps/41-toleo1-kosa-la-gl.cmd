@echo off
rem HATUA 41 - JARIBIO 1.c KWENYE STAGING: kosa la GL la kulazimishwa -^> gl_posting_failure -^> "Jaribu tena".
rem INABADILISHA STAGING TU, KWA MUDA: constraint qa_toleo1_zuia_sale_cash kwenye journal_entry (NOT VALID, inazuia
rem journal mpya za SALE_CASH tu), sale moja ya jaribio "QA-T1 K" (kipande 1), kisha constraint INAONDOLEWA na kosa linajaribiwa tena.
rem Wakati constraint ipo (sekunde chache), sale yoyote ya cash ya staging haipati journal - ni staging tu, hakuna anayeuza.
rem Constraint inaondolewa hata node ikishindwa. Production HAIGUSWI (ps tu).
rem Lazima: CONSTRAINT_IMEWEKWA^|1, PASS 1.c-kosa, CONSTRAINT_IMEONDOLEWA^|0, PASS 1.c-retry, PASS makosa-wazi.
rem Lazima kwanza: tunnel.cmd wazi. Endesha baada ya 40. Itakuuliza password ya root@system.com ya STAGING.
rem Password: inaulizwa kwa PowerShell Read-Host -AsSecureString - herufi hazionekani (* tu), haiandikwi kwenye log
rem   wala faili lolote, inafutwa kwenye variable mwishoni. Ni password ya root@system.com ya STAGING, ambayo ni
rem   ya PROD wakati wa dump: staging inarejeshwa kutoka dump ya prod. Dump ya 20/10 02:00 ni KABLA password ya root
rem   ya PROD haijabadilishwa 20/10, kwa hiyo staging ya sasa ina password ya ZAMANI; staging ikirejeshwa tena kutoka
rem   dump ya baadaye itakuwa na password MPYA ya prod.
rem Matokeo: analysis\steps\41-toleo1-kosa-la-gl.log
rem Kila sehemu inaandika [exit N]; stdout NA stderr ya kila amri ya Contabo zinapita kwenye ficha.awk KWENYE SERVER.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\41-toleo1-kosa-la-gl.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-41--- > %L%
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set NODE_C=
set NODE_D=
set ONDOA_RC=
set WEKA_RC=
set STEP=STAGING-LAZIMA-2.2.71
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-staging && echo TOLEO_ENV_$(grep '^BACKEND_VERSION=' .env | cut -d= -f2 | tr -dc '0-9') && [ $(grep -c '^BACKEND_VERSION=' .env) = 1 ] && grep -qx 'BACKEND_VERSION=2.2.71' .env; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\41-toleo1-kosa-la-gl.log" TOLEO_ENV_2271
if not defined NIMEPATA (
  echo SIYO: ishara TOLEO_ENV_2271 haipo - .env ya staging si toleo 2.2.71 >> %L%
  set RC=1
  goto fail
)
set STEP=TUNNEL-LAZIMA-400
echo ---%STEP%--- >> %L%
curl -s -o nul -w "%%{http_code}" -X POST -H "Content-Type: application/json" -d "{}" http://localhost:8081/api/auth/login > analysis\steps\41-tunnel.txt 2>&1
set RC=%errorlevel%
type analysis\steps\41-tunnel.txt >> %L%
echo. >> %L%
echo [exit %RC%] >> %L%
set "NIMEPATA="
call :mstari_pekee "analysis\steps\41-tunnel.txt" 400
if not defined NIMEPATA (
  echo SIYO: tunnel haijibu 400 - fungua analysis\steps\tunnel.cmd >> %L%
  set RC=1
  goto fail
)
set STEP=DATA-YA-BIDHAA-READ-ONLY
echo ---%STEP%--- >> %L%
ssh %SSHO% contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1; } 2>&1 | awk %F%" < analysis\steps\39-toleo1-kabla.sql > analysis\steps\39-toleo1-data.txt 2>&1
set RC=%errorlevel%
type analysis\steps\39-toleo1-data.txt >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"T1DATA|" analysis\steps\39-toleo1-data.txt > nul
if errorlevel 1 (
  echo SIYO: hakuna mstari T1DATA kwenye data ya staging >> %L%
  set RC=1
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
set STEP=WEKA-CONSTRAINT-YA-MUDA
echo ---%STEP%--- >> %L%
ssh %SSHO% contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1; } 2>&1 | awk %F%" < analysis\steps\41-kosa-weka.sql >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" (
  set WEKA_RC=%RC%
  goto ondoa
)
set STEP=NODE-AWAMU-C
echo ---%STEP%--- >> %L%
node analysis\steps\39-toleo1-jaribu.mjs C >> %L% 2>&1
set NODE_C=%errorlevel%
set RC=%NODE_C%
echo [exit %NODE_C%] >> %L%
:ondoa
set STEP=ONDOA-CONSTRAINT
echo ---%STEP%--- >> %L%
ssh %SSHO% contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1; } 2>&1 | awk %F%" < analysis\steps\41-kosa-ondoa.sql >> %L% 2>&1
set ONDOA_RC=%errorlevel%
echo [exit %ONDOA_RC%] >> %L%
if not "%ONDOA_RC%"=="0" (
  set RC=%ONDOA_RC%
  echo !!! CONSTRAINT HAIJAONDOLEWA - sale za cash za staging hazipati journal. Niambie mara moja. !!! >> %L%
  goto fail
)
if defined WEKA_RC (
  set STEP=WEKA-CONSTRAINT-YA-MUDA
  set RC=%WEKA_RC%
  goto fail
)
if not "%NODE_C%"=="0" (
  set STEP=NODE-AWAMU-C
  goto fail
)
set STEP=NODE-AWAMU-D
echo ---%STEP%--- >> %L%
node analysis\steps\39-toleo1-jaribu.mjs D >> %L% 2>&1
set NODE_D=%errorlevel%
set RC=%NODE_D%
echo [exit %NODE_D%] >> %L%
set ROOT_PASS=
set STEP=PROD-PS
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%NODE_D%"=="0" (
  set STEP=NODE-AWAMU-D
  set RC=%NODE_D%
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - 1.c kosa la GL na Jaribu tena vimepita, constraint ya jaribio imeondolewa. Matokeo: %L%. Nitumie log; prod 1.8 inafuata.
goto end
:fail
set ROOT_PASS=
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Kama CONSTRAINT_IMEONDOLEWA^|0 haipo kwenye log, niambie mara moja.
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
