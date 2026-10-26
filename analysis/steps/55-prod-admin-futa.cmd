@echo off
rem HATUA 55 - KUFUTA KABISA admin@admin.com KWENYE PROD (mmiliki 26/10: hard delete, si tombstone). INAANDIKA MOJA KWA MOJA
rem   KWENYE DB YA PROD (psql ndani ya container) - kwa uamuzi wa mmiliki tu. HAITEGEMEI 2.2.72 NA HAIFANYI restart.
rem Mpangilio: 56 (leo) -^> ukaguzi wa log ya 56 -^> (ikiwa ORODHA: 56b + uamuzi wa mmiliki) -^> 55.
rem KINGA (PC): log ya 56 inaishia ---OK--- na TAREHE_YA_56 ni leo, NA MOJA YA NJIA HIZI MBILI:
rem   (A) 56 = HITIMISHO HAKUNA_USHAHIDI_WA_MATUMIZI; au
rem   (B) mmiliki 26/10 g: 56 = HITIMISHO ORODHA, log ya 56b inaishia ---OK---, ina HITIMISHO_56B (yoyote) na TAREHE_YA_56B ni leo,
rem       NA analysis\steps\55-uamuzi.txt lina mstari "UAMUZI_MMILIKI_55 ENDELEA ^<leo yyyymmdd^>" peke yake. Log inaandika
rem       RUHUSA_55 UAMUZI_WA_MMILIKI (si HAKUNA_USHAHIDI_WA_MATUMIZI). Njia nyingine yoyote = IMEKATALIWA.
rem   KINGA (server, analysis\steps\55-admin-futa.sh + 55-admin-futa.sql):
rem   ROOT_EMAIL_YA_BACKEND [root@system.com]; root@system.com ipo, ACTIVE, is_root; admin kwa id=9 + email + uid; users 9; is_root 2;
rem   marejeo yanayoruhusiwa kwa jina kamili TU: user_branches.user_uid (inafutwa ndani ya transaction, safu 1),
rem   backup_20260930_journal_entry.posted_by (haiguswi), order_suggestion_line.user_packs (namba ya pakiti); rejeo lingine
rem   lolote ^> 0, au FK kwenda users yenye CASCADE / SET NULL / SET DEFAULT isiyoorodheshwa = IMEKATALIWA.
rem MWENDO: (1) kagua kwenye server (kinga zote, READ ONLY, ROLLBACK) -^> (2) mmiliki anaandika FUTA -^> (3) futa: nakala ya
rem   users id=9 + user_branches (bila password/token) ~/backups/55-admin-^<saa^>.json chmod 600, kisha transaction
rem   DELETE user_branches + DELETE users (safu 1 kila moja, vinginevyo ROLLBACK) -^> (4) baada: admin 0, users 8, is_root 1,
rem   hali-root SASA -^> (5) root@system.com inaingia: login 1 (password inaulizwa bila kuonekana, haiandikwi popote).
rem Kurudia baada ya kufuta: server inaona admin haipo (users 8, is_root 1) = ADMIN_ILISHAFUTWA_55, inathibitisha tu.
rem Matokeo: analysis\steps\55-prod-admin-futa.log
rem Kila output ya Contabo inapita ficha.awk kwenye server; ssh zote %SSHO% -n (isipokuwa zenye stdin).
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\55-prod-admin-futa.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
set ROOT_PASS=
echo ---MWENDESHO-55--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\56-prod-admin-tukio.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 56 haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: endesha 56 kwanza na imalizike ---OK---. 55 haijaendeshwa.
  goto end
)
set "LEO="
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd"') do set "LEO=%%d"
if not defined LEO (
  echo ---IMEKATALIWA: tarehe ya leo haikusomeka - hakuna kilichoendeshwa--- >> %L%
  goto end
)
set "NJIA="
findstr /b /c:"HITIMISHO ORODHA" analysis\steps\56-prod-admin-tukio.log > nul
if errorlevel 1 goto njia_a
rem ---- NJIA B: 56 = ORODHA, 56b + uamuzi wa mmiliki (26/10 g) ----
set "NIMEPATA="
call :mwisho_ni "analysis\steps\56b-prod-admin-tukio-ufafanuzi.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: 56 = HITIMISHO ORODHA na log ya 56b haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: 56 imetoa ORODHA; endesha 56b na imalizike ---OK---. 55 haijaendeshwa.
  goto end
)
set "H56B="
for /f "tokens=2" %%h in ('findstr /b /c:"HITIMISHO_56B " analysis\steps\56b-prod-admin-tukio-ufafanuzi.log') do set "H56B=%%h"
if not defined H56B (
  echo ---IMEKATALIWA: log ya 56b haina HITIMISHO_56B - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: log ya 56b haina HITIMISHO_56B. 55 haijaendeshwa.
  goto end
)
set "T56B="
for /f "tokens=2" %%t in ('findstr /b /c:"TAREHE_YA_56B " analysis\steps\56b-prod-admin-tukio-ufafanuzi.log') do set "T56B=%%t"
if not "%T56B%"=="%LEO%" (
  echo ---IMEKATALIWA: 56b haikuendeshwa leo ^(%T56B%, leo %LEO%^) - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: 56b si ya leo. Endesha 56 na 56b tena. 55 haijaendeshwa.
  goto end
)
set "NIMEPATA="
if exist "analysis\steps\55-uamuzi.txt" call :mstari_pekee_tatu "analysis\steps\55-uamuzi.txt" UAMUZI_MMILIKI_55 ENDELEA %LEO%
if not defined NIMEPATA (
  echo ---IMEKATALIWA: 56 = ORODHA na analysis\steps\55-uamuzi.txt halina mstari "UAMUZI_MMILIKI_55 ENDELEA %LEO%" - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: 56 = ORODHA na hakuna uamuzi wa mmiliki wa leo kwenye analysis\steps\55-uamuzi.txt. 55 haijaendeshwa.
  goto end
)
set "NJIA=UAMUZI_WA_MMILIKI"
echo RUHUSA_55 UAMUZI_WA_MMILIKI - imeruhusiwa kwa uamuzi wa mmiliki baada ya 56 ^(HITIMISHO ORODHA^) na 56b ^(HITIMISHO_56B %H56B%, %T56B%^); 55-uamuzi.txt: UAMUZI_MMILIKI_55 ENDELEA %LEO%. SI HAKUNA_USHAHIDI_WA_MATUMIZI. >> %L%
goto tarehe56
:njia_a
rem ---- NJIA A: 56 = HAKUNA_USHAHIDI_WA_MATUMIZI ----
set "NIMEPATA="
call :mstari_pekee_mbili "analysis\steps\56-prod-admin-tukio.log" HITIMISHO HAKUNA_USHAHIDI_WA_MATUMIZI
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya 56 haina HITIMISHO HAKUNA_USHAHIDI_WA_MATUMIZI wala HITIMISHO ORODHA - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: log ya 56 haina hitimisho linalotambulika. 55 haijaendeshwa.
  goto end
)
set "NJIA=HAKUNA_USHAHIDI_WA_MATUMIZI"
echo RUHUSA_55 HAKUNA_USHAHIDI_WA_MATUMIZI - 56 haikupata ushahidi wa matumizi. >> %L%
:tarehe56
set "T56="
for /f "tokens=2" %%t in ('findstr /b /c:"TAREHE_YA_56 " analysis\steps\56-prod-admin-tukio.log') do set "T56=%%t"
echo 56: tarehe %T56%; leo %LEO%; njia %NJIA% >> %L%
if not "%T56%"=="%LEO%" (
  echo ---IMEKATALIWA: 56 haikuendeshwa leo ^(%T56%, leo %LEO%^) - endesha 56 tena; hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: 56 si ya leo. Endesha 56 tena. 55 haijaendeshwa.
  goto end
)
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\hali-root.sh contabo:/tmp/hali-root.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\55-admin-futa.sql contabo:/tmp/55-admin-futa.sql >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\55-admin-futa.sh contabo:/tmp/55-admin-futa.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=KAGUA-READ-ONLY
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/55-admin-futa.sh kagua; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\55-prod-admin-futa.log" ADMIN_ILISHAFUTWA_55
if defined NIMEPATA (
  echo admin ilishafutwa awali - hakuna cha kufuta; login ya root inafuata >> %L%
  goto login
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\55-prod-admin-futa.log" KAGUA_55_SAWA
if not defined NIMEPATA (
  echo SIYO: kagua haikutoa KAGUA_55_SAWA >> %L%
  set RC=1
  goto fail
)
type %L%
set "JIBU="
set /p JIBU=Andika FUTA kufuta admin@admin.com KABISA kwenye DB ya PROD - kingine chochote = simama:
if not "%JIBU%"=="FUTA" (
  echo ---IMESIMAMISHWA-NA-MMILIKI: hakuna kilichobadilishwa--- >> %L%
  set STEP=MMILIKI-AMESIMAMISHA
  set RC=1
  goto fail
)
echo mmiliki ameandika: FUTA >> %L%
set STEP=FUTA
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/55-admin-futa.sh futa; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\55-prod-admin-futa.log" ADMIN_IMEFUTWA_55
if not defined NIMEPATA (
  echo SIYO: futa haikutoa ADMIN_IMEFUTWA_55 >> %L%
  set RC=1
  goto fail
)
:login
set "NIMEPATA="
call :mstari_pekee "analysis\steps\55-prod-admin-futa.log" BAADA_SAWA_55
if not defined NIMEPATA (
  echo SIYO: hakuna BAADA_SAWA_55 - admin 0, users 8, is_root 1 havikuthibitishwa >> %L%
  set STEP=BAADA
  set RC=1
  goto fail
)
set STEP=ROOT-LOGIN-1
echo ---%STEP%--- >> %L%
set "ROOT_PASS="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya root@system.com ya PROD (login 1) - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "ROOT_PASS=%%p"
if not defined ROOT_PASS (
  echo ---PASSWORD-HAIKUANDIKWA--- >> %L%
  set RC=1
  goto fail
)
set TARGET=prod
set PROD_API=https://elikom.co.tz
node analysis\steps\55-root-login.mjs >> %L% 2>&1
set RC=%errorlevel%
set ROOT_PASS=
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\55-prod-admin-futa.log" ROOT_LOGIN_SAWA
if not defined NIMEPATA (
  echo SIYO: root haikuingia >> %L%
  set RC=1
  goto fail
)
echo RUHUSA_ILIYOTUMIKA %NJIA% >> %L%
echo ---VICHUJIO-VIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/hali-root.sh /tmp/55-admin-futa.sh /tmp/55-admin-futa.sql && echo vichujio vimefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - admin@admin.com imefutwa kabisa kwenye prod ^(ruhusa: %NJIA%^); users 8, is_root 1; root@system.com imeingia. Matokeo: %L%. Nitumie log.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/hali-root.sh /tmp/55-admin-futa.sh /tmp/55-admin-futa.sql" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Ikiwa kosa ni la SQL: transaction ilirudishwa, hakuna kilichofutwa. Nitumie log.
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
rem :mstari_pekee_mbili "<faili>" <neno1> <neno2> - NIMEPATA=1 ikiwa mstari fulani una <neno1> <neno2> PEKE YAKE (bila kujali CR).
:mstari_pekee_mbili
setlocal EnableDelayedExpansion
set "CR="
for /f %%a in ('copy /Z "%~f0" nul') do set "CR=%%a"
set "P="
for /f "usebackq tokens=1,2,3" %%A in ("%~1") do (
  set "A=%%A" & set "B=%%B" & set "C=%%C."
  for %%r in ("!CR!") do (set "A=!A:%%~r=!" & set "B=!B:%%~r=!" & set "C=!C:%%~r=!")
  if "!A!"=="%~2" if "!B!"=="%~3" if "!C!"=="." set "P=1"
)
endlocal & set "NIMEPATA=%P%"
goto :eof
rem :mstari_pekee_tatu "<faili>" <neno1> <neno2> <neno3> - NIMEPATA=1 ikiwa mstari fulani una maneno hayo matatu PEKE YAKE.
:mstari_pekee_tatu
setlocal EnableDelayedExpansion
set "CR="
for /f %%a in ('copy /Z "%~f0" nul') do set "CR=%%a"
set "P="
for /f "usebackq tokens=1,2,3,4" %%A in ("%~1") do (
  set "A=%%A" & set "B=%%B" & set "C=%%C" & set "D=%%D."
  for %%r in ("!CR!") do (set "A=!A:%%~r=!" & set "B=!B:%%~r=!" & set "C=!C:%%~r=!" & set "D=!D:%%~r=!")
  if "!A!"=="%~2" if "!B!"=="%~3" if "!C!"=="%~4" if "!D!"=="." set "P=1"
)
endlocal & set "NIMEPATA=%P%"
goto :eof
