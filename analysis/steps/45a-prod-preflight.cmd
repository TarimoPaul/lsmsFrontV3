@echo off
rem HATUA 45a - PREFLIGHT YA §1.8 (PROD). KUSOMA TU kwa prod: haigusi DB wala container ya prod.
rem Inakagua (kwenye server, 45a-prod-preflight.sh): dirisha (usiku 02:30-05:59, au mchana 06:00-13:59 kwa kibali);
rem   log ya backup ya 02:00 ya leo ina OK na UPLOADED (njia kutoka crontab / ~/backup-lsms.sh); dump ya 02:00 sha256 Contabo = B2;
rem   saa ya FREEZE unayoandika (HH:MM EAT) inaandikwa kwenye log; kisha DUMP MPYA ya prod BAADA ya freeze kwa ~/backup-lsms.sh
rem   (script ya backup iliyopo; B2 - 45a inapakia yenyewe ikiwa script haikupakia); sha256 Contabo = B2; Flyway ya dump mpya = 133;
rem   prod 2.2.70 na .env 2.2.70; image 2.2.71 ya server ina digest sha256:047084562507162306daf153adbcf3b00884883b6f84f860f0c8461c3ece35d2 (37 / 38c) = staging;
rem   maombi ya kuandika (POST/PUT/PATCH/DELETE /api, bila auth) kwenye nginx ya prod tangu freeze: zaidi ya 0 = SIMAMA.
rem Kinachoandikwa: dump mpya (Contabo + B2), /tmp/staging-restore (nakala ya B2 ya dump mpya, kwa 45b), faili za muda (zinafutwa).
rem Kinga: inakataa kuanza ikiwa log ya 41 (staging ya Toleo 1), 50 (jaribio la rollback) au 38e (V3 3.1.11 staging) haiishii ---OK---.
rem Matokeo: analysis\steps\45a-prod-preflight.log
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
set L=analysis\steps\45a-prod-preflight.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-45a--- > %L%
echo.
echo ONYO: tangu FREEZE hadi mwisho wa 47 HAKUNA mtu anayetumia LSMS - sales, reco, capex, malipo. Mazoezi ni ya dump mpya ya 45a.
echo.
set "NIMEPATA="
call :mwisho_ni "analysis\steps\41-toleo1-kosa-la-gl.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 41 haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 41 haikuisha na ---OK---. Soma analysis\steps\41-toleo1-kosa-la-gl.log na umalize 41 kwanza. 45a haijaendeshwa.
  goto end
)
set "NIMEPATA="
call :mwisho_ni "analysis\steps\50-staging-rollback-2270.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 50 haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 50 haikuisha na ---OK---. Soma analysis\steps\50-staging-rollback-2270.log na umalize 50 kwanza. 45a haijaendeshwa.
  goto end
)
set "NIMEPATA="
call :mwisho_ni "analysis\steps\38e-staging-v3-3111.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 38e haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 38e haikuisha na ---OK---. Soma analysis\steps\38e-staging-v3-3111.log na umalize 38e kwanza. 45a haijaendeshwa.
  goto end
)
set "DIRISHA=USIKU"
set "JIBU_DIRISHA="
if /i "%LSMS_DIRISHA%"=="ASUBUHI" set /p JIBU_DIRISHA=Kibali cha mmiliki - andika asubuhi kuendesha hatua hii ASUBUHI - kingine = kanuni ya usiku 02:30-05:59: 
if /i "%LSMS_DIRISHA%"=="ASUBUHI" if /i "%JIBU_DIRISHA%"=="asubuhi" set "DIRISHA=ASUBUHI"
for /f "usebackq tokens=1,2" %%a in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do echo KIBALI_DIRISHA %DIRISHA% - LSMS_DIRISHA ni [%LSMS_DIRISHA%], jibu [%JIBU_DIRISHA%], saa %%a %%b EAT>> %L%
set "JIBU_DIRISHA="
set "FREEZE="
set /p FREEZE=Saa ya FREEZE ya leo - ulipositisha matumizi ya LSMS - HH:MM EAT, mfano 06:15: 
powershell -NoProfile -Command "if ($env:FREEZE -match '^([01][0-9]|2[0-3]):[0-5][0-9]$') { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo ---FREEZE-SI-HH:MM: hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: saa ya freeze lazima iwe HH:MM, mfano 06:15. 45a haijaendeshwa.
  goto end
)
echo FREEZE_ILIYOANDIKWA_NA_MMILIKI %FREEZE% EAT >> %L%
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=SCRIPT-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\45a-prod-preflight.sh contabo:/tmp/45a-prod-preflight.sh >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=PREFLIGHT-KWENYE-CONTABO
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/45a-prod-preflight.sh %DIRISHA% %FREEZE%; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" DIRISHA_SAWA
if not defined NIMEPATA (
  echo SIYO: nje ya dirisha >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" BACKUP_LOG_LEO_OK_UPLOADED
if not defined NIMEPATA (
  echo SIYO: log ya backup ya leo haina OK na UPLOADED >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" DUMP_LEO_B2_SAWA
if not defined NIMEPATA (
  echo SIYO: dump ya 02:00 ya Contabo na B2 si sawa >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" FREEZE_SAWA
if not defined NIMEPATA (
  echo SIYO: saa ya freeze haikukubaliwa >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" BACKUP_MPYA_SAWA
if not defined NIMEPATA (
  echo SIYO: dump mpya ya baada ya freeze haikupatikana >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" DUMP_MPYA_B2_SHA256_SAWA
if not defined NIMEPATA (
  echo SIYO: sha256 ya dump mpya Contabo na B2 si sawa >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" DUMP_FLYWAY_133_SAWA
if not defined NIMEPATA (
  echo SIYO: Flyway ya dump mpya si 133 >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" PROD_2270_SAWA
if not defined NIMEPATA (
  echo SIYO: prod haiendeshi 2.2.70 >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" PROD_ENV_2270_SAWA
if not defined NIMEPATA (
  echo SIYO: .env ya prod si 2.2.70 >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" DIGEST_2271_SAWA_NA_STAGING
if not defined NIMEPATA (
  echo SIYO: digest ya 2.2.71 si ya staging >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" NGINX_LOG_INAFANYA_KAZI
if not defined NIMEPATA (
  echo SIYO: log ya nginx haionyeshi maombi >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45a-prod-preflight.log" MAANDISHI_TANGU_FREEZE_HAKUNA
if not defined NIMEPATA (
  echo SIYO: kuna maombi ya kuandika baada ya freeze - SIMAMA >> %L%
  set RC=1
  goto fail
)
set "FZ="
for /f "tokens=2" %%t in ('findstr /b /l /c:"FREEZE_EPOCH " analysis\steps\45a-prod-preflight.log') do set "FZ=%%t"
echo FREEZE_EPOCH kutoka 45a: %FZ% >> %L%
if not defined FZ (
  echo SIYO: log ya 45a haina FREEZE_EPOCH >> %L%
  set STEP=45A-FREEZE-EPOCH
  set RC=1
  goto fail
)
set "DJ="
for /f "tokens=2" %%t in ('findstr /b /l /c:"DUMP_MPYA_JINA " analysis\steps\45a-prod-preflight.log') do set "DJ=%%t"
echo DUMP_MPYA_JINA kutoka 45a: %DJ% >> %L%
if not defined DJ (
  echo SIYO: log ya 45a haina DUMP_MPYA_JINA >> %L%
  set STEP=45A-DUMP-MPYA-JINA
  set RC=1
  goto fail
)
set "DSHA="
for /f "tokens=2" %%t in ('findstr /b /l /c:"DUMP_MPYA_SHA256 " analysis\steps\45a-prod-preflight.log') do set "DSHA=%%t"
echo DUMP_MPYA_SHA256 kutoka 45a: %DSHA% >> %L%
if not defined DSHA (
  echo SIYO: log ya 45a haina DUMP_MPYA_SHA256 >> %L%
  set STEP=45A-DUMP-MPYA-SHA256
  set RC=1
  goto fail
)
ssh %SSHO% -n contabo "rm -f /tmp/45a-prod-preflight.sh" >> %L% 2>&1
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - preflight imepita: backup ya 02:00 OK + UPLOADED, dump mpya %DJ% ya baada ya freeze sha256 Contabo = B2, Flyway 133, prod 2.2.70, digest = staging, maandishi tangu freeze 0. Matokeo: %L%. Sasa 45b.
goto end
:fail
ssh %SSHO% -n contabo "rm -f /tmp/45a-prod-preflight.sh" >> %L% 2>&1
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
