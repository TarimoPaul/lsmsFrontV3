@echo off
rem HATUA 45i - .env YA PROD ili boot iache kuiwasha admin@admin.com (45g: ROOT_EMAIL_YA_BACKEND [admin@admin.com]). INABADILISHA PROD.
rem   Server (nyuma, 45-bg.sh) - analysis\steps\45i-prod-env-root.sh badilisha:
rem    a) nakala .env.bak.45i.^<saa^> chmod 600; nakala za .env zenye JWT_SECRET ya ZAMANI (44, deploy ya 45d) zinafutwa mwishoni;
rem    b) ROOT_EMAIL=root@system.com, ROOT_PASSWORD inaondolewa; diff ya MAJINA tu (thamani hazionyeshwi), kupitia ficha;
rem    c) backend PEKE YAKE inaundwa upya (up -d --no-deps backend) - Started LsmsApplication + PUBLIC_API_400;
rem    d) ROOT_EMAIL_YA_BACKEND [root@system.com]. ROLLBACK (.env ya nakala + backend upya) NI HAPA TU: (c) backend haikuanza
rem       au ROOT_EMAIL_YA_BACKEND si [root@system.com]. Rollback inarudisha ROOT_EMAIL=admin@admin.com, kwa hiyo boot inaiwasha
rem       admin@admin.com TENA - script inaandika hilo wazi: izime kwenye V3 mara moja.
rem   PC (d): node 45i-thibitisha.mjs - root@system.com inaingia (JARIBIO 1 TU la login) na admin@admin.com bado INACTIVE.
rem    Ikishindwa: HAKUNA rollback, HAKUNA restart - .env mpya inabaki (mmiliki 21/10: rollback ingeifufua admin na kuongeza
rem    kosa la login). Ujumbe: ENV IMEFANIKIWA - ...; usirudie; leta log. Alama 45i-pc-imeshindwa.txt inazuia kurudia 45i.
rem LINI: kibali ASUBUHI, KUANZA hadi 11:15; au usiku 02:30-05:59 kwa kanuni ya usiku; au JIONI ya 22/10 TU (set
rem   LSMS_DIRISHA=JIONI-20261022 + jioni) KUANZA 16:00-21:30, haijaisha 21:45 = ONYO. HAITEGEMEI 47. Inakataa kuanza ikiwa
rem   46b / 43 / 47 imeanza leo na haijaisha (restart ingeikatiza).
rem KUKATIKA KWA UMEME/MTANDAO (mmiliki 21/10): sehemu ya Contabo inaendeshwa NYUMA kwenye server (45-bg.sh: setsid + nohup,
rem   log ~/lsms-hatua/^<kazi^>/log) - ssh ikikatika kazi ya server inaendelea hadi mwisho wake, pamoja na rollback yake.
rem   PC inafuatilia kila sek 10. Ukikatika: endesha hatua hii TENA - inagundua kazi imefika wapi: haijaanza = inaanza
rem   (pamoja na kinga zote); inaendesha = inafuatilia tu; imeisha = inasoma log na kumaliza. Kazi HAIANZI mara mbili.
rem   IMEKUFA (hakuna mwisho na mchakato haupo, mf. server ilizimwa) = SIMAMA, niambie. Log ya jaribio lililopita: ^<log^>.awali
rem Kinga: log ya 45g ---OK---.
rem Matokeo: analysis\steps\45i-prod-env-root.log
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
set L=analysis\steps\45i-prod-env-root.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-45i--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\45g-prod-b2-c-d.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 45g haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 45g haikuisha na ---OK---. Soma analysis\steps\45g-prod-b2-c-d.log na umalize 45g kwanza. 45i haijaendeshwa.
  goto end
)
set "KUENDELEA="
if exist %L%.awali findstr /l /c:"BG_IMEANZA" /c:"BG_IPO" %L%.awali > nul && set "KUENDELEA=1"
if defined KUENDELEA echo KUENDELEA: jaribio lililopita lilianza kazi ya server - dirisha halizuii kuifuatilia >> %L%
set "DIRISHA=USIKU"
set "JIBU_DIRISHA="
if /i "%LSMS_DIRISHA%"=="JIONI-20261022" set /p JIBU_DIRISHA=Kibali cha mmiliki - andika jioni kuendesha hatua hii JIONI ya 2026-10-22 - kingine = kanuni ya usiku 02:30-05:59: 
set "TAREHE_EAT="
for /f "usebackq tokens=1" %%a in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do set "TAREHE_EAT=%%a"
if /i "%LSMS_DIRISHA%"=="JIONI-20261022" if /i "%JIBU_DIRISHA%"=="jioni" if "%TAREHE_EAT%"=="2026-10-22" set "DIRISHA=JIONI"
if /i "%LSMS_DIRISHA%"=="JIONI-20261022" if not "%TAREHE_EAT%"=="2026-10-22" echo KIBALI_JIONI_KIMEKATALIWA: kibali JIONI-20261022 ni cha 2026-10-22 tu - leo ni %TAREHE_EAT% >> %L%
if /i "%LSMS_DIRISHA%"=="JIONI-20261022" if not "%TAREHE_EAT%"=="2026-10-22" echo KIBALI cha jioni ni cha 2026-10-22 tu - leo ni %TAREHE_EAT%; kinakataliwa.
if /i "%LSMS_DIRISHA%"=="ASUBUHI" set /p JIBU_DIRISHA=Kibali cha mmiliki - andika asubuhi kuendesha hatua hii ASUBUHI - kingine = kanuni ya usiku 02:30-05:59: 
if /i "%LSMS_DIRISHA%"=="ASUBUHI" if /i "%JIBU_DIRISHA%"=="asubuhi" set "DIRISHA=ASUBUHI"
for /f "usebackq tokens=1,2" %%a in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do echo KIBALI_DIRISHA %DIRISHA% - LSMS_DIRISHA ni [%LSMS_DIRISHA%], jibu [%JIBU_DIRISHA%], saa %%a %%b EAT>> %L%
set "JIBU_DIRISHA="
set "SAA="
for /f "usebackq tokens=2" %%t in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do set "SAA=%%t"
set "SAWA="
if "%SAA%" GEQ "0230" if "%SAA%" LEQ "0559" set "SAWA=1"
if "%DIRISHA%"=="ASUBUHI" if "%SAA%" GEQ "0600" if "%SAA%" LEQ "1115" set "SAWA=1"
if "%DIRISHA%"=="JIONI" if "%TAREHE_EAT%"=="2026-10-22" if "%SAA%" GEQ "1600" if "%SAA%" LEQ "2130" set "SAWA=1"
echo saa ya Tanzania %SAA% - dirisha %DIRISHA% - mwisho wa asubuhi 1115, mwisho wa jioni ya 2026-10-22 2130 >> %L%
if defined KUENDELEA set "SAWA=1"
if not defined SAWA (
  echo ---IMEKATALIWA: nje ya dirisha - saa %SAA% EAT, dirisha %DIRISHA% - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: saa %SAA% EAT iko nje ya dirisha. Usiku 02:30-05:59, au asubuhi 06:00-1115 kwa kibali, au jioni ya 2026-10-22 1600-2130 kwa kibali JIONI-20261022. 45i haijaendeshwa.
  goto end
)
if exist analysis\steps\45i-pc-imeshindwa.txt (
  echo ---IMEKATALIWA: uthibitisho wa PC wa 45i ulishindwa awali ^(45i-pc-imeshindwa.txt^) - usirudie; leta log--- >> %L%
  type analysis\steps\45i-pc-imeshindwa.txt
  echo IMEKATALIWA: uthibitisho wa PC wa 45i ulishindwa awali - USIRUDIE ^(kila jaribio ni login ya root^). Leta log ya 45i.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "GL_INAENDELEA="
for /f "usebackq tokens=1" %%t in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do if exist analysis\steps\46-prod-hali-%%t.json set "GL_INAENDELEA=1"
if defined GL_INAENDELEA (
  set "NIMEPATA="
  call :mwisho_ni "analysis\steps\46b-prod-marekebisho-andika.log" ---OK---
)
if defined GL_INAENDELEA if not defined NIMEPATA (
  echo ---IMEKATALIWA: 46b-prod-marekebisho-andika imeanza leo na haijaisha - 45i ingeikatiza kwa restart; hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: 46b-prod-marekebisho-andika imeanza leo na haijaisha. Maliza hatua hiyo kwanza, kisha 45i.
  goto end
)
set "GL_INAENDELEA="
for /f "usebackq tokens=1" %%t in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do if exist analysis\steps\43-prod-hali-%%t.json set "GL_INAENDELEA=1"
if defined GL_INAENDELEA (
  set "NIMEPATA="
  call :mwisho_ni "analysis\steps\43-m7-prod.log" ---OK---
)
if defined GL_INAENDELEA if not defined NIMEPATA (
  echo ---IMEKATALIWA: 43-m7-prod imeanza leo na haijaisha - 45i ingeikatiza kwa restart; hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: 43-m7-prod imeanza leo na haijaisha. Maliza hatua hiyo kwanza, kisha 45i.
  goto end
)
set "GL_INAENDELEA="
for /f "usebackq tokens=1" %%t in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do if exist analysis\steps\47-prod-hali-%%t.json set "GL_INAENDELEA=1"
if defined GL_INAENDELEA (
  set "NIMEPATA="
  call :mwisho_ni "analysis\steps\47-prod-funga-jan-sep.log" ---OK---
)
if defined GL_INAENDELEA if not defined NIMEPATA (
  echo ---IMEKATALIWA: 47-prod-funga-jan-sep imeanza leo na haijaisha - 45i ingeikatiza kwa restart; hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: 47-prod-funga-jan-sep imeanza leo na haijaisha. Maliza hatua hiyo kwanza, kisha 45i.
  goto end
)
set "ROOT_PASS="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya root@system.com ya PROD (kwa uthibitisho d, jaribio 1) - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "ROOT_PASS=%%p"
if not defined ROOT_PASS (
  echo ---PASSWORD-HAIKUANDIKWA: hakuna kilichotumwa--- >> %L%
  set STEP=PASSWORD-HAIKUANDIKWA
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
set "BGID=45i-env-root"
set "BGH=analysis\steps\45i-env-root-hali.txt"
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
set "SAWA2="
if "%SAA%" GEQ "0230" if "%SAA%" LEQ "0559" set "SAWA2=1"
if "%DIRISHA%"=="ASUBUHI" if "%SAA%" GEQ "0600" if "%SAA%" LEQ "1115" set "SAWA2=1"
if "%DIRISHA%"=="JIONI" if "%TAREHE_EAT%"=="2026-10-22" if "%SAA%" GEQ "1600" if "%SAA%" LEQ "2130" set "SAWA2=1"
if not defined SAWA2 (
  echo ---IMEKATALIWA: kazi ya 45i haipo kwenye server na saa %SAA% iko nje ya dirisha - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: kazi ya 45i haipo kwenye server na saa %SAA% iko nje ya dirisha. 45i haijaendeshwa.
  goto end
)
type %L%
set "JIBU="
set /p JIBU=Andika ndio kubadilisha .env ya PROD na kuunda upya backend - kingine chochote = simama: 
if /i not "%JIBU%"=="ndio" (
  echo ---IMESIMAMISHWA-NA-MMILIKI: hakuna kilichobadilishwa--- >> %L%
  set STEP=MMILIKI-AMESIMAMISHA
  set RC=1
  goto fail
)
echo mmiliki ameandika: ndio >> %L%
set STEP=KAZI-INAANZA-KWENYE-SERVER
echo ---%STEP%--- >> %L%
scp %SSHO% "analysis\steps\45i-prod-env-root.sh" contabo:/tmp/lsms-bg-%BGID%.sh >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
ssh %SSHO% -n contabo "bash ~/lsms-hatua/45-bg.sh anza %BGID% /tmp/lsms-bg-%BGID%.sh badilisha 2>&1 | awk %F%; rm -f /tmp/lsms-bg-%BGID%.sh" > %BGH% 2>&1
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
  findstr /l /c:"ROLLBACK_IMEFANYIKA" %L% > nul && echo TAHADHARI: rollback ya .env imefanyika - admin@admin.com IMEWASHWA TENA na boot - izime kwenye V3 mara moja
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "%L%" ---OK---
if not defined NIMEPATA (
  echo SIYO: log ya server haina ---OK--- >> %L%
  set RC=1
  findstr /l /c:"ROLLBACK_IMEFANYIKA" %L% > nul && echo TAHADHARI: rollback ya .env imefanyika - admin@admin.com IMEWASHWA TENA na boot - izime kwenye V3 mara moja
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45i-prod-env-root.log" BACKEND_ROOT_EMAIL_SAWA
if not defined NIMEPATA (
  echo SIYO: log ya server haina BACKEND_ROOT_EMAIL_SAWA >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45i-prod-env-root.log" ENV_ROOT_PASSWORD_HAIPO
if not defined NIMEPATA (
  echo SIYO: log ya server haina ENV_ROOT_PASSWORD_HAIPO >> %L%
  set RC=1
  goto fail
)
set "B45I="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$m = @(Select-String -LiteralPath 'analysis\steps\45i-prod-env-root.log' -CaseSensitive -Pattern '^BACKUP_YA_45I (\S+)\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); if ($m.Count -eq 1 -and $m[0] -cmatch '^\.env\.bak\.45i\.\d{8}_\d{6}$') { $m[0] } else { 'KOSA:' + ($m -join ',') }"`) do set "B45I=%%v"
if not defined B45I set "B45I=KOSA:"
echo BACKUP_YA_45I kutoka 45i: %B45I% >> %L%
if "%B45I:~0,5%"=="KOSA:" (
  echo SIYO: BACKUP_YA_45I kwenye analysis\steps\45i-prod-env-root.log haipo, si moja, au muundo wake si sahihi >> %L%
  set STEP=45I-BACKUP-YA-45I
  set RC=1
  goto fail
)
if not defined PROD_API set "PROD_API=https://elikom.co.tz"
echo PROD_API=%PROD_API% >> %L%
set TARGET=prod
set STEP=D-UTHIBITISHO-WA-PC
echo ---%STEP%--- >> %L%
node analysis\steps\45i-thibitisha.mjs >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
set ROOT_PASS=
if "%RC%"=="0" goto thibitisho_sawa
echo %DATE% %TIME% uthibitisho wa PC wa 45i umeshindwa ^(exit %RC%^) - .env mpya inabaki > analysis\steps\45i-pc-imeshindwa.txt
echo SIYO: uthibitisho wa PC umeshindwa - .env MPYA INABAKI ^(hakuna rollback, hakuna restart^). USIRUDIE 45i; leta log hii >> %L%
echo ENV IMEFANIKIWA - uthibitisho wa PC haukupita ^(soma mstari wa ENV IMEFANIKIWA kwenye log^); USIRUDIE 45i; leta log.
set STEP=D-UTHIBITISHO-WA-PC
set RC=1
goto fail
:thibitisho_sawa
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45i-prod-env-root.log" THIBITISHO_45I_SAWA
if not defined NIMEPATA (
  echo SIYO: uthibitisho wa PC haukupita >> %L%
  set RC=1
  goto fail
)
set "SAA2="
for /f "usebackq tokens=2" %%t in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do set "SAA2=%%t"
if "%DIRISHA%"=="JIONI" if "%SAA2%" GTR "2145" echo ONYO: saa %SAA2% EAT - hatua hii haijaisha kabla ya 21:45 ^(dirisha la jioni^). Mwambie mmiliki SASA. >> %L%
if "%DIRISHA%"=="JIONI" if "%SAA2%" GTR "2145" echo ONYO: saa %SAA2% EAT - hatua hii haijaisha kabla ya 21:45 ^(dirisha la jioni^). Mwambie mmiliki SASA.
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - .env ya prod: ROOT_EMAIL=root@system.com, ROOT_PASSWORD imeondolewa; backend inaitumia; admin@admin.com INACTIVE; root inaingia. Matokeo: %L%.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Ikiwa ni muunganiko KABLA ya uthibitisho wa PC: endesha 45i TENA - itafuatilia kazi ileile. Uthibitisho wa PC ukishindwa: USIRUDIE, nitumie log.
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
