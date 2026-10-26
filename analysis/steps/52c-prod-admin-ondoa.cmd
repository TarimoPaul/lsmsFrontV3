@echo off
rem HATUA 52c - KUONDOA admin@admin.com KWENYE PROD. INAANDIKA MOJA KWA MOJA KWENYE DB YA PROD (psql ndani ya container) - KINYUME
rem   na kanuni ya 15/10 ya kutogusa DB ya prod; ni kwa uamuzi wa mmiliki wa 21/10 tu. Uamuzi unatoka 52b:
rem   DELETE (marejeo 0; FK zinahesabiwa tena ndani ya transaction, zikiwepo = ROLLBACK) au TOMBSTONE (INACTIVE, is_root=false,
rem   email deleted+admin@invalid, password isiyo BCrypt). Nakala ya jedwali users kabla ya kuandika: ~/backups/52c-users-^<saa^>.sql.
rem   Baada: restart ya backend; admin@admin.com lazima iwe 0 (haikuundwa upya) na root@system.com bado root ACTIVE.
rem   Script: analysis\steps\52c-admin-ondoa.sh.
rem MPANGILIO (mmiliki 21/10 - SI LEO): 45i .env (22/10) -^> 2.2.72 kwenye prod (23/10) -^> 48 nakala ya 02:00 -^> 52b marejeo -^> 52c kuondoa admin.
rem   Kwa nini: DataInitializer ya 2.2.71 (DataInitializer.java:257-279) INAUNDA akaunti ya root.email upya kama ROOT (password ya
rem   ROOT_PASSWORD au default) ikiwa haipo. Kwa hiyo admin@admin.com isiondolewe kabla ya 2.2.72 na kabla ROOT_EMAIL haijarekebishwa.
rem KUKATIKA KWA UMEME/MTANDAO (mmiliki 21/10): sehemu ya Contabo inaendeshwa NYUMA kwenye server (45-bg.sh: setsid + nohup,
rem   log ~/lsms-hatua/^<kazi^>/log) - ssh ikikatika kazi ya server inaendelea hadi mwisho wake, pamoja na rollback yake.
rem   PC inafuatilia kila sek 10. Ukikatika: endesha hatua hii TENA - inagundua kazi imefika wapi: haijaanza = inaanza
rem   (pamoja na kinga zote); inaendesha = inafuatilia tu; imeisha = inasoma log na kumaliza. Kazi HAIANZI mara mbili.
rem   IMEKUFA (hakuna mwisho na mchakato haupo, mf. server ilizimwa) = SIMAMA, niambie. Log ya jaribio lililopita: ^<log^>.awali
rem Kinga: 52b ---OK--- (na UAMUZI); kwenye server: backend 2.2.72, ROOT_EMAIL ya .env na backend = root@system.com (45i), ROOT_PASSWORD haipo.
rem Matokeo: analysis\steps\52c-prod-admin-ondoa.log
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
set L=analysis\steps\52c-prod-admin-ondoa.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-52c--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\52b-admin-marejeo.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 52b haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 52b haikuisha na ---OK---. Soma analysis\steps\52b-admin-marejeo.log na umalize 52b kwanza. 52c haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "UAMUZI="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$m = @(Select-String -LiteralPath 'analysis\steps\52b-admin-marejeo.log' -CaseSensitive -Pattern '^UAMUZI (\S+)\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); if ($m.Count -eq 1 -and $m[0] -cmatch '^(DELETE|TOMBSTONE)$') { $m[0] } else { 'KOSA:' + ($m -join ',') }"`) do set "UAMUZI=%%v"
if not defined UAMUZI set "UAMUZI=KOSA:"
echo UAMUZI kutoka 52b: %UAMUZI% >> %L%
if "%UAMUZI:~0,5%"=="KOSA:" (
  echo SIYO: UAMUZI kwenye analysis\steps\52b-admin-marejeo.log haipo, si moja, au muundo wake si sahihi >> %L%
  set STEP=52B-UAMUZI
  set RC=1
  goto fail
)
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
set "BGID=52c-admin-ondoa"
set "BGH=analysis\steps\52c-admin-ondoa-hali.txt"
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
set STEP=PROD-NI-2.2.72
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { cd ~/lsms-deployment && I=$(docker compose ps backend --format '{{.Image}}') && echo backend $I && case $I in *:2.2.72) echo PROD_2272;; esac; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\52c-prod-admin-ondoa.log" PROD_2272
if not defined NIMEPATA (
  echo SIYO: backend ya prod si 2.2.72 - hakuna kilichobadilishwa >> %L%
  set RC=1
  goto fail
)
type %L%
set "JIBU="
set /p JIBU=Andika %UAMUZI% kuondoa admin@admin.com kwenye DB ya PROD - kingine chochote = simama: 
if /i not "%JIBU%"=="%UAMUZI%" (
  echo ---IMESIMAMISHWA-NA-MMILIKI: hakuna kilichobadilishwa--- >> %L%
  set STEP=MMILIKI-AMESIMAMISHA
  set RC=1
  goto fail
)
echo mmiliki ameandika: %UAMUZI% >> %L%
set STEP=KAZI-INAANZA-KWENYE-SERVER
echo ---%STEP%--- >> %L%
scp %SSHO% "analysis\steps\52c-admin-ondoa.sh" contabo:/tmp/lsms-bg-%BGID%.sh >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
ssh %SSHO% -n contabo "bash ~/lsms-hatua/45-bg.sh anza %BGID% /tmp/lsms-bg-%BGID%.sh %UAMUZI% 2>&1 | awk %F%; rm -f /tmp/lsms-bg-%BGID%.sh" > %BGH% 2>&1
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
set "NIMEPATA="
call :mstari_pekee "analysis\steps\52c-prod-admin-ondoa.log" KINGA_ZA_MPANGILIO_SAWA
if not defined NIMEPATA (
  echo SIYO: log ya server haina KINGA_ZA_MPANGILIO_SAWA >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\52c-prod-admin-ondoa.log" ADMIN_HAIPO_BAADA_YA_RESTART
if not defined NIMEPATA (
  echo SIYO: log ya server haina ADMIN_HAIPO_BAADA_YA_RESTART >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\52c-prod-admin-ondoa.log" ROOT_SYSTEM_SAWA
if not defined NIMEPATA (
  echo SIYO: log ya server haina ROOT_SYSTEM_SAWA >> %L%
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - admin@admin.com imeondolewa kwenye prod (%UAMUZI%) na haikuundwa upya baada ya restart; root@system.com ni root ACTIVE. Matokeo: %L%.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Ikiwa ni muunganiko: endesha 52c TENA - itafuatilia kazi ileile. Vinginevyo nitumie log - nakala ya users iko ~/backups/52c-users-*.sql.
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
