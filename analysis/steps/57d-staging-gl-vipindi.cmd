@echo off
rem HATUA 57d - VIPIMO VYA VIPINDI VILIVYOFUNGWA KWENYE STAGING 2.2.72 dhidi ya Postgres HALISI (mmiliki 26/10). INAANDIKA STAGING TU:
rem   2026-09 inafungwa (na kufunguliwa upya kwanza ikiwa tayari imefungwa) ili kupima lock ya close vs post; safu 1 ya majaribio
rem   kwenye gl_posting_failure na journal 1 ya late entry (01/10, 1,000) zinabaki kwenye staging. Script: analysis\steps\57d-gl-vipindi.mjs
rem   1) lock: kikao cha psql kinashika lock ya SHARED ya journal kwa sek 20; close ya 2026-09 lazima isubiri (^>= sek 5) kisha ifanikiwe.
rem   2) 2026-09 CLOSED: repost-sale, /reverse, journal ya mkono ya 20/09, backfill, DELETE /entries -^> zinakataliwa, hakuna journal mpya.
rem   1b) post halisi ya leo (1 TZS) wakati close inasubiri -^> zote zinamalizika ^< sek 90 (hakuna deadlock), kisha inageuzwa.
rem   1c) close iliendesha control-checks bila kosa.
rem   3) retry ya safu ya 15/09 -^> journal 01/10 (event_date 15/09, is_late_entry) na safu resolved RETRIED.
rem   4) safu ya GL_REVERSAL (journal ya 09) -^> retry bado inakataliwa, attempts 2, hakuna reversal; safu inafungwa QA_57D.
rem Lazima kwanza: 57c ---OK---; dirisha jingine lenye analysis\steps\tunnel.cmd (localhost:8081 -^> staging).
rem Password ya root@system.com ya STAGING inaulizwa bila kuonekana na haiandikwi popote. Matokeo: analysis\steps\57d-staging-gl-vipindi.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\57d-staging-gl-vipindi.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-57d--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\57c-staging-2272.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 57c haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 57c haikuisha na ---OK---. Soma analysis\steps\57c-staging-2272.log. 57d haijaendeshwa.
  goto end
)
set STEP=TUNNEL-LAZIMA-400
echo ---%STEP%--- >> %L%
curl -s -o nul -w "%%{http_code}" -X POST -H "Content-Type: application/json" -d "{}" http://localhost:8081/api/auth/login > analysis\steps\57d-tunnel.txt 2>&1
type analysis\steps\57d-tunnel.txt >> %L%
echo. >> %L%
set "NIMEPATA="
call :mstari_pekee "analysis\steps\57d-tunnel.txt" 400
if not defined NIMEPATA (
  echo SIYO: tunnel haijibu 400 - fungua analysis\steps\tunnel.cmd kwenye dirisha jingine >> %L%
  set RC=1
  goto fail
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=DIGEST-KABLA
call :digest KABLA
if not defined NIMEPATA goto fail
set STEP=VIPIMO-VYA-VIPINDI
echo ---%STEP%--- >> %L%
set "ROOT_PASS="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya root@system.com ya STAGING - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "ROOT_PASS=%%p"
if not defined ROOT_PASS (
  echo ---PASSWORD-HAIKUANDIKWA--- >> %L%
  set RC=1
  goto fail
)
set TARGET=staging
set API=http://localhost:8081
node analysis\steps\57d-gl-vipindi.mjs >> %L% 2>&1
set RC=%errorlevel%
set ROOT_PASS=
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"MUHTASARI 57d gl vipindi (staging): PASS " %L% | findstr /l /c:"FAIL 0," > nul
if errorlevel 1 (
  echo SIYO: MUHTASARI haina FAIL 0 >> %L%
  set RC=1
  goto fail
)
set STEP=DIGEST-BAADA
call :digest BAADA
if not defined NIMEPATA goto fail
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - vipimo vya vipindi vilivyofungwa vya 2.2.72 kwenye staging vimepita. Matokeo: %L%. Nitumie log.
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
rem :digest <KABLA|BAADA> - NIMEPATA=1 ikiwa container ya backend ya staging inaendesha image ya digest ya 57a HASA
rem (mmiliki 26/10 k: si tag tu; tofauti -^> SIMAMA). Inaandika DIGEST_2272_SAWA_<KABLA|BAADA> kwenye log.
:digest
echo ---DIGEST-%1--- >> %L%
ssh %SSHO% -n contabo "cd ~/lsms-staging && C=$(docker compose -p lsms-staging ps -q backend) && I=$(docker inspect --format '{{.Image}}' $C) && D=$(docker image inspect --format '{{.Id}}' chiefmaster/my-lsms-backend@sha256:ad3c59458436a043cf795390d5c334a48984a16ed2e149cc72bd533edb43359a) && echo container $I && echo digest $D && [ -n $I ] && [ $I = $D ] && echo DIGEST_2272_SAWA_%1" >> %L% 2>&1
set "NIMEPATA="
call :mstari_pekee "%L%" DIGEST_2272_SAWA_%1
if not defined NIMEPATA (
  echo SIYO: backend ya staging haiendeshi digest ya 57a - SIMAMA >> %L%
  set RC=1
)
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
