@echo off
rem HATUA 44 = (a0) ya MPANGO 1.8 - KUBADILISHA JWT_SECRET YA PROD. INABADILISHA PROD: ~/lsms-deployment/.env (mstari wa JWT_SECRET tu)
rem   na kuunda upya container ya backend. Token zote zinakufa: KILA MTUMIAJI ANAINGIA UPYA (V3, simu, print agent).
rem   Script ileile 44-jwt-secret-prod.sh (bila kubadilishwa): thamani mpya inatengenezwa KWENYE SERVER, haichapishwi; log ina
rem   urefu na sha256 (12) tu; ikishindwa baada ya kubadilisha .env, inarudisha .env ya zamani yenyewe.
rem LINI (kabla ya kuanza tu): 00:00-05:59 EAT, au 06:00-15:14 EAT kwa kibali (set LSMS_DIRISHA=ASUBUHI + asubuhi). Script inakagua tena.
rem KUKATIKA KWA UMEME/MTANDAO (mmiliki 21/10): sehemu ya Contabo inaendeshwa NYUMA kwenye server (45-bg.sh: setsid + nohup,
rem   log ~/lsms-hatua/^<kazi^>/log) - ssh ikikatika kazi ya server inaendelea hadi mwisho wake, pamoja na rollback yake.
rem   PC inafuatilia kila sek 10. Ukikatika: endesha hatua hii TENA - inagundua kazi imefika wapi: haijaanza = inaanza
rem   (pamoja na kinga zote); inaendesha = inafuatilia tu; imeisha = inasoma log na kumaliza. Kazi HAIANZI mara mbili.
rem   IMEKUFA (hakuna mwisho na mchakato haupo, mf. server ilizimwa) = SIMAMA, niambie. Log ya jaribio lililopita: ^<log^>.awali
rem Kinga: inakataa kuanza ikiwa log ya 45e (prod 2.2.71 + digest ya staging) haiishii ---OK---.
rem Matokeo: analysis\steps\44-jwt-secret-prod.log
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
set L=analysis\steps\44-jwt-secret-prod.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-44--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\45e-prod-baada-ya-deploy.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 45e haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 45e haikuisha na ---OK---. Soma analysis\steps\45e-prod-baada-ya-deploy.log na umalize 45e kwanza. 44 haijaendeshwa.
  goto end
)
set "DIRISHA=USIKU"
set "JIBU_DIRISHA="
if /i "%LSMS_DIRISHA%"=="ASUBUHI" set /p JIBU_DIRISHA=Kibali cha mmiliki - andika asubuhi kuendesha hatua hii ASUBUHI - kingine = kanuni ya usiku 02:30-05:59: 
if /i "%LSMS_DIRISHA%"=="ASUBUHI" if /i "%JIBU_DIRISHA%"=="asubuhi" set "DIRISHA=ASUBUHI"
for /f "usebackq tokens=1,2" %%a in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do echo KIBALI_DIRISHA %DIRISHA% - LSMS_DIRISHA ni [%LSMS_DIRISHA%], jibu [%JIBU_DIRISHA%], saa %%a %%b EAT>> %L%
set "JIBU_DIRISHA="
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
set "BGID=44-jwt-toleo1"
set "BGH=analysis\steps\44-jwt-toleo1-hali.txt"
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
set STEP=DIRISHA-44
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { N=$(TZ=Africa/Dar_es_Salaam date +%%H%%M) && echo saa $(TZ=Africa/Dar_es_Salaam date '+%%F %%H:%%M') EAT dirisha %DIRISHA% && { [ $N -le 0559 ] || { [ %DIRISHA% = ASUBUHI ] && [ $N -ge 0600 ] && [ $N -le 1514 ]; }; } && echo DIRISHA_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\44-jwt-secret-prod.log" DIRISHA_SAWA
if not defined NIMEPATA (
  echo SIYO: nje ya dirisha la 44 - haijaanza >> %L%
  set RC=1
  goto fail
)
set STEP=KAZI-INAANZA-KWENYE-SERVER
echo ---%STEP%--- >> %L%
scp %SSHO% "analysis\steps\44-jwt-secret-prod.sh" contabo:/tmp/lsms-bg-%BGID%.sh >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
ssh %SSHO% -n contabo "bash ~/lsms-hatua/45-bg.sh anza %BGID% /tmp/lsms-bg-%BGID%.sh %DIRISHA% 2>&1 | awk %F%; rm -f /tmp/lsms-bg-%BGID%.sh" > %BGH% 2>&1
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
if "%HALI%"=="BG_HALI_INAENDESHA" if %BGN% GEQ 60 goto bg_muda
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
echo SIYO: kazi bado inaendesha baada ya dakika 10 - endesha hatua hii tena kuifuatilia >> %L%
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
set "NIMEPATA="
call :mstari_pekee "%L%" ---OK---
if not defined NIMEPATA (
  echo SIYO: log ya server haina ---OK--- >> %L%
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - JWT_SECRET ya prod imebadilishwa na backend imeanza upya. Matokeo: %L%. Sasa unaweza kuendesha 45f - (a) ukaguzi wa password ya root.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Ikiwa ni muunganiko: endesha 44 TENA - itafuatilia kazi ileile. Ikiwa script ilishindwa: angalia mstari wa ROLLBACK, niambie.
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
