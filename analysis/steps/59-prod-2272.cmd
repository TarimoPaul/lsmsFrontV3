@echo off
rem HATUA 59 - DEPLOY YA PROD: backend 2.2.71 -^> 2.2.72 (hotfix dd198ea, HAKUNA migration). INABADILISHA PRODUCTION. (mmiliki 26/10 m2)
rem   Dirisha: 27/10/2026 ASUBUHI TU - set LSMS_DIRISHA=ASUBUHI + kuandika asubuhi; KUANZA 06:00-11:59 EAT (kabla ya 12:00).
rem   Kinga za PC: 57d ---OK---; reco ZOTE za 2026-10-26 APPROVED/CLOSED na snapshot (46-reco-kinga.mjs, akaunti ya CEO, GET tu).
rem   Server (NYUMA kwa 45-bg.sh, kazi 59-prod-2272; script analysis\steps\59-prod-2272.sh):
rem     kinga: prod 2.2.71; ROOT_EMAIL ya .env na ya container [root@system.com]; admin@admin.com HAIPO; is_root_wote 1; users 8;
rem       Flyway 102 134; openCount ya posting-failures; pull + digest sha256:ad3c5945...43359a; hali-root KABLA;
rem       hakuna write ya mtumiaji tangu hatua ianze (45-maandishi.sh, kama 46b);
rem     deploy: remote-deploy-backend.sh 2.2.72 ya main (dump iliyothibitishwa, BACKEND_VERSION tu, restart ya backend, health);
rem     baada: container = digest; TOLEO_ENV_2272; boot bila Creating/Activating ROOT user ya akaunti nyingine; ERROR za boot 0;
rem       hali-root BAADA (users 8, is_root 1, root ACTIVE, updated_at ile ile); Flyway 102 134; openCount haiongezeki.
rem     ROLLBACK chochote kikishindwa baada ya restart: 2.2.71 (.backend.prev) -^> restart -^> hali-root tena (ROLLBACK_2271_SAWA).
rem   /api chini ~65s. Haibadilishi .backend-version wala git (2.2.72 ni ya hotfix/2.2.72; merge kwenda main ni yako).
rem KUKATIKA KWA UMEME/MTANDAO: kazi ya server inaendelea yenyewe. Endesha hatua hii TENA: inaendesha = inafuatilia tu;
rem   imeisha = inasoma log na kumaliza. Kazi HAIANZI mara mbili. IMEKUFA = SIMAMA, niambie. Log ya jaribio lililopita: ^<log^>.awali
rem Kanuni za 1.8: kila output ya Contabo inapita ficha.awk kwenye server; ssh zote %SSHO% -n; password inaulizwa bila kuonekana.
rem Matokeo: analysis\steps\59-prod-2272.log (pamoja na log nzima ya server). Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\59-prod-2272.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set "DEPLOYSH=D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms\deploy\remote-deploy-backend.sh"
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-59--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\57d-staging-gl-vipindi.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 57d haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 57d haikuisha na ---OK---. 59 haijaendeshwa.
  goto end
)
if not exist "%DEPLOYSH%" (
  echo ---IMEKATALIWA: %DEPLOYSH% haipo--- >> %L%
  echo IMEKATALIWA: remote-deploy-backend.sh haipo. 59 haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
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
set "BGID=59-prod-2272"
set "BGH=analysis\steps\59-prod-2272-hali.txt"
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
set "DIRISHA=HAKUNA"
set "JIBU_DIRISHA="
if /i "%LSMS_DIRISHA%"=="ASUBUHI" set /p JIBU_DIRISHA=Kibali cha mmiliki - andika asubuhi kuendesha 59 ASUBUHI ya 27/10 - kingine = simama:
if /i "%LSMS_DIRISHA%"=="ASUBUHI" if /i "%JIBU_DIRISHA%"=="asubuhi" set "DIRISHA=ASUBUHI"
for /f "usebackq tokens=1,2" %%a in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do echo KIBALI_DIRISHA %DIRISHA% - LSMS_DIRISHA ni [%LSMS_DIRISHA%], jibu [%JIBU_DIRISHA%], saa %%a %%b EAT>> %L%
set "JIBU_DIRISHA="
set STEP=DIRISHA-27-10-ASUBUHI
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { D=$(TZ=Africa/Dar_es_Salaam date +%%F) && N=$(TZ=Africa/Dar_es_Salaam date +%%H%%M) && echo saa $D $N EAT dirisha %DIRISHA% && [ %DIRISHA% = ASUBUHI ] && [ $D = 2026-10-27 ] && [ $N -ge 0600 ] && [ $N -le 1159 ] && echo DIRISHA_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set "NIMEPATA="
call :mstari_pekee "analysis\steps\59-prod-2272.log" DIRISHA_SAWA
if not defined NIMEPATA (
  echo SIYO: nje ya dirisha - 59 inaanza 27/10/2026 06:00-11:59 EAT tu, kwa LSMS_DIRISHA=ASUBUHI + kuandika asubuhi >> %L%
  set RC=1
  goto fail
)
if not defined PROD_API set "PROD_API=https://elikom.co.tz"
echo PROD_API=%PROD_API% >> %L%
set "CEO_EMAIL="
set /p CEO_EMAIL=Email ya akaunti yako ya CEO ya PROD (kusoma reco tu) - si root:
if not defined CEO_EMAIL (
  set STEP=EMAIL-HAIKUANDIKWA
  set RC=1
  goto fail
)
if /i "%CEO_EMAIL%"=="root@system.com" (
  echo ---IMEKATALIWA: root@system.com ni ROOT - reco inasomwa kwa akaunti ya CEO--- >> %L%
  set STEP=AKAUNTI-YA-ROOT
  set RC=1
  goto fail
)
echo email iliyoandikwa: %CEO_EMAIL% >> %L%
set "CEO_PASS="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya PROD ya akaunti hiyo - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "CEO_PASS=%%p"
if not defined CEO_PASS (
  set STEP=PASSWORD-HAIKUANDIKWA
  set RC=1
  goto fail
)
set TARGET=prod
set STEP=RECO-YA-2026-10-26-IMEKAMILIKA
echo ---%STEP%--- >> %L%
node analysis\steps\46-reco-kinga.mjs 2026-10-26 >> %L% 2>&1
set RC=%errorlevel%
set CEO_PASS=
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\59-prod-2272.log" RECO_IMEFUNGWA
if not defined NIMEPATA (
  echo SIYO: reco ya 2026-10-26 haijaisha - deploy haianzi >> %L%
  set RC=1
  goto fail
)
set STEP=SAA-YA-KUANZA-NA-TAARIFA-YA-SAA-1
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\45-maandishi.sh contabo:/tmp/45-maandishi.sh >> %L% 2>&1
set RC=%errorlevel%
if not "%RC%"=="0" goto fail
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/45-maandishi.sh SAA1 SAA1 taarifa; R=$?; rm -f /tmp/45-maandishi.sh; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "K59="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$m = @(Select-String -LiteralPath 'analysis\steps\59-prod-2272.log' -CaseSensitive -Pattern '^SAA_YA_SERVER_KUANZA (\S+)\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); if ($m.Count -eq 1 -and $m[0] -cmatch '^\d{9,11}$') { $m[0] } else { 'KOSA:' + ($m -join ',') }"`) do set "K59=%%v"
if not defined K59 set "K59=KOSA:"
echo SAA_YA_SERVER_KUANZA ya 59: %K59% >> %L%
if "%K59:~0,5%"=="KOSA:" (
  echo SIYO: SAA_YA_SERVER_KUANZA haipo, si moja, au muundo wake si sahihi >> %L%
  set RC=1
  goto fail
)
set STEP=ZANA-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { rm -rf ~/lsms-hatua/59-zana && mkdir -p ~/lsms-hatua/59-zana && echo 59-zana tayari; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\hali-root.sh contabo:lsms-hatua/59-zana/hali-root.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\45-maandishi.sh contabo:lsms-hatua/59-zana/45-maandishi.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% "%DEPLOYSH%" contabo:lsms-hatua/59-zana/remote-deploy-backend.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\59-prod-2272.sh contabo:/tmp/lsms-bg-%BGID%.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "JIBU="
set /p JIBU=Andika ndio kuanza deploy ya 2.2.72 kwenye PROD - /api chini ~65s - kingine chochote = simama:
if /i not "%JIBU%"=="ndio" (
  echo ---IMESIMAMISHWA-NA-MMILIKI: deploy haijaanza--- >> %L%
  set STEP=MMILIKI-AMESIMAMISHA
  set RC=1
  goto fail
)
echo mmiliki ameandika: ndio >> %L%
set STEP=KAZI-INAANZA-KWENYE-SERVER
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "bash ~/lsms-hatua/45-bg.sh anza %BGID% /tmp/lsms-bg-%BGID%.sh %K59% 2>&1 | awk %F%; rm -f /tmp/lsms-bg-%BGID%.sh" > %BGH% 2>&1
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
if "%HALI%"=="BG_HALI_INAENDESHA" if %BGN% GEQ 120 goto bg_muda
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
echo SIYO: kazi bado inaendesha baada ya dakika 20 - endesha hatua hii tena kuifuatilia >> %L%
set STEP=BADO-INAENDESHA-ENDESHA-TENA
set RC=1
goto fail
:bg_matokeo
set STEP=BG-LOG-YA-SERVER
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "bash ~/lsms-hatua/45-bg.sh log %BGID% 2>&1 | awk %F%" >> %L% 2>&1
echo hali ya mwisho ya kazi %BGID%: %HALI% >> %L%
if not "%HALI%"=="BG_HALI_IMEISHA_0" goto bg_imeshindwa
for %%w in (PROD_BADO_2271 DIGEST_PULL_SAWA WRITES_TANGU_KUANZA_0 DIGEST_INAYOENDESHA_SAWA TOLEO_ENV_2272 ERROR_ZA_BOOT_0 FLYWAY_HAIJABADILIKA OPENCOUNT_HAIJAONGEZEKA ---59_SERVER_MWISHO---) do (
  set "NIMEPATA="
  call :mstari_pekee "analysis\steps\59-prod-2272.log" %%w
  if not defined NIMEPATA (
    echo SIYO: log ya server haina %%w >> %L%
    set RC=1
    goto fail
  )
)
findstr /b /l /c:"DEPLOY_59_OK 2.2.72" %L% > nul
if errorlevel 1 (
  echo SIYO: log ya server haina DEPLOY_59_OK 2.2.72 >> %L%
  set RC=1
  goto fail
)
set STEP=PUBLIC-API-KUPITIA-CLOUDFLARE-ONYO-TU
echo ---%STEP%--- >> %L%
curl -s -o nul -m 20 -w "HTTP_%%{http_code}" -X POST -H "Content-Type: application/json" -d "{}" https://elikom.co.tz/api/auth/login >> %L% 2>&1
echo. >> %L%
echo ---ZANA-NA-KICHUJIO-VIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -rf ~/lsms-hatua/59-zana /tmp/ficha-lsms.awk && echo zana na kichujio vimefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - PROD inaendesha 2.2.72 (digest ya 57a); root/users/Flyway/openCount sawa. Matokeo: %L%. Nitumie log.
goto end
:bg_imeshindwa
set STEP=SERVER-59-%HALI%
set "NIMEPATA="
call :mstari_pekee "analysis\steps\59-prod-2272.log" ROLLBACK_2271_SAWA
if defined NIMEPATA echo ROLLBACK: prod imerudishwa 2.2.71 na hali-root ni sawa - soma SIYO kwenye log >> %L%
if defined NIMEPATA echo ROLLBACK: prod imerudishwa 2.2.71 na hali-root ni sawa.
findstr /b /l /c:"ROLLBACK_IMESHINDWA" %L% > nul
if not errorlevel 1 echo HATARI: ROLLBACK IMESHINDWA - angalia server SASA >> %L%
if not errorlevel 1 echo HATARI: ROLLBACK IMESHINDWA - angalia server SASA, nitumie log mara moja.
set RC=1
goto fail
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/45-maandishi.sh" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Ikiwa ni muunganiko: endesha 59 TENA - itafuatilia kazi ileile ya server. Vinginevyo usiendelee, nitumie log.
:end
set CEO_PASS=
endlocal
goto :eof
rem :mstari_pekee "<faili>" <neno> - NIMEPATA=1 ikiwa mstari fulani wa <faili> una <neno> PEKE YAKE, bila kujali
rem nafasi, tab au CR (CRLF, LF, au bila mwisho wa mstari).
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
rem :mwisho_ni "<faili>" <neno> - NIMEPATA=1 ikiwa mstari wa MWISHO usio tupu wa <faili> ni <neno> PEKE YAKE. Faili lisilokuwepo = HAPANA.
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
