@echo off
rem HATUA 38a - KUPAKUA DUMP YA USIKU YA LEO YA PROD KUTOKA B2 + KULINGANISHA. Haigusi database yoyote wala container yoyote.
rem Kwa nini: jaribio la Toleo 1 (marekebisho ya journals 87 za variance, sales 3 za H-2) lifanyike kwenye data ya LEO,
rem           na staging ipite hatua zilezile za Flyway kama prod (prod 133 -^> 134).
rem Prod inasomwa bila kugusa DB yake: docker compose ps tu (kanuni ya 15/10). Toleo la Flyway la prod linasomwa kutoka
rem   kwenye DUMP iliyopakuliwa (pg_restore --data-only ya flyway_schema_history kwenda stdout; HAIGUSI DB yoyote),
rem   si kutoka log ya backend: mstari wa Flyway wa startup haupo tena backend ikiwa Up siku kadhaa (20/10).
rem Jina la dump linahesabiwa kwenye Contabo kwa tarehe ya leo (EAT): lsms_YYYYMMDD_0200.dump, linaandikwa /tmp/staging-restore/JINA.
rem Kinachobadilika: faili la muda /tmp/staging-restore/^<jina^> kwenye Contabo (na /tmp/ficha-lsms.awk, linafutwa mwishoni).
rem Lazima: PROD_2270_SAWA, SHA_SAWA, DUMP_FLYWAY_133_SAWA. Staging lazima iwe inaendesha (36-1) kwa pg_restore.
rem Kinga: inakataa kuanza ikiwa log ya 37 haina [OK] BUILD_OK 2.2.71 na ---MWISHO---.
rem Matokeo: analysis\steps\38a-toleo1-pakua-dump.log
rem Kila sehemu inaandika [exit N]; stdout NA stderr ya kila amri ya Contabo zinapita kwenye ficha.awk KWENYE SERVER.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\38a-toleo1-pakua-dump.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-38a--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\37-toleo1-build-2271.log" ---MWISHO---
if defined NIMEPATA (
  findstr /b /l /c:"[OK] BUILD_OK 2.2.71" analysis\steps\37-toleo1-build-2271.log > nul
  if errorlevel 1 set "NIMEPATA="
)
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 37 haina [OK] BUILD_OK 2.2.71 na ---MWISHO--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 37 haikuisha na BUILD_OK 2.2.71. Soma analysis\steps\37-toleo1-build-2271.log. 38a haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PROD-PS-LAZIMA-BACKEND-2.2.70
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}' && docker compose ps backend --format '{{.Image}}' | grep -qx 'chiefmaster/my-lsms-backend:2.2.70' && echo PROD_2270_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=JINA-LA-DUMP-YA-LEO
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { mkdir -p /tmp/staging-restore && D=$(TZ=Africa/Dar_es_Salaam date +%%Y%%m%%d) && echo lsms_${D}_0200.dump > /tmp/staging-restore/JINA && cat /tmp/staging-restore/JINA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=DUMP-ZA-MWISHO-B2-NA-CONTABO
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { rclone lsf b2:elikom-lsms-backups/daily/ | sort | tail -3 && ls -l ~/backups/daily/ | tail -3; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PAKUA-KUTOKA-B2
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { J=$(cat /tmp/staging-restore/JINA) && rclone copyto b2:elikom-lsms-backups/daily/$J /tmp/staging-restore/$J && ls -l /tmp/staging-restore; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=SHA256-B2-NA-NAKALA-YA-CONTABO
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { J=$(cat /tmp/staging-restore/JINA) && sha256sum /tmp/staging-restore/$J ~/backups/daily/$J; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=DUMP-INASOMEKA-idadi-ya-TABLE-DATA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { J=$(cat /tmp/staging-restore/JINA) && cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_restore -l < /tmp/staging-restore/$J | grep -c 'TABLE DATA'; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=LINGANISHA-BYTE-KWA-BYTE
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { J=$(cat /tmp/staging-restore/JINA) && cmp /tmp/staging-restore/$J ~/backups/daily/$J && echo SHA_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PROD-FLYWAY-KUTOKA-DUMP-LAZIMA-133
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { J=$(cat /tmp/staging-restore/JINA) && cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_restore --data-only -n public -t flyway_schema_history -f - < /tmp/staging-restore/$J | awk -F'\t' '/^COPY /{f=1;next} f && NF>=10 && $2 ~ /^[0-9]+$/ && $10 ~ /^t$/ {print $2+0}' | sort -n | tail -3 > /tmp/staging-restore/FLYWAY.txt && sed 's/^/dump flyway: /' /tmp/staging-restore/FLYWAY.txt && tail -1 /tmp/staging-restore/FLYWAY.txt | grep -qx 133 && echo DUMP_FLYWAY_133_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - dump ya leo imepakuliwa: SHA_SAWA na DUMP_FLYWAY_133_SAWA. Matokeo: %L%. Sasa unaweza kuendesha 38b.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Usiendelee na hatua ya 38b.
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
