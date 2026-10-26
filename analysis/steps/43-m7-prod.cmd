@echo off
rem HATUA 43 - M-7 KWENYE PROD (njia B). INAANDIKA KWENYE GL YA PROD: journals 2 za mkono (MANUAL_ADJUSTMENT):
rem   (1) 04/10: Dr 1000 / Cr 2000 6,751,443.39 - kufuta malipo 7 ya wasambazaji ya 04/10 (entry numbers kwenye maelezo);
rem   (2) 30/09: Dr 2000 / Cr 1000 6,751,443.39 - malipo ya Feb-Jul kutoka benki.
rem Mpangilio: deploy -^> marekebisho ya 1.8 (46b) -^> HATUA HII -^> kufunga Jan-Sep (47). Kwa akaunti yako ya CEO (si root).
rem   1) kagua (HAIANDIKI): journals 7, jumla 6,751,443.39, Septemba wazi, M-7 haijaandikwa, na salio za kabla SAWA na mazoezi;
rem   2) unaandika andika; 3) journals 2 + ukaguzi wa tofauti + salio za baada SAWA na mazoezi.
rem Kinga: inakataa kuanza ikiwa log ya 46b haiishii ---OK---.
rem Matokeo: analysis\steps\43-m7-prod.log na analysis\steps\43-m7-prod.json
rem Dirisha la 22/10 (mmiliki 21/10 16:xx): baada ya reco ya 2026-10-21 kufungwa, kwa kibali cha ASUBUHI; KUANZA hadi 11:00 tu (46a 10:30; 46b/43/47 11:00). Iliyokwisha anza inaendelea; haijaisha 11:45 = ONYO.
rem JIONI ya 22/10 TU (mmiliki 22/10 - umeme wa duka umekatika): set LSMS_DIRISHA=JIONI-20261022 + kuandika jioni; KUANZA 16:00-21:00 (46a 20:00; 46b/43/47 21:00; 45i 21:30). Iliyokwisha anza inaendelea; haijaisha 21:45 = ONYO.
rem   Tarehe nyingine yoyote: kibali hicho kinakataliwa. Kinga nyingine zote hazijabadilika.
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
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\43-m7-prod.log
set STEP=
set RC=
echo ---MWENDESHO-43--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\46b-prod-marekebisho-andika.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 46b haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 46b haikuisha na ---OK---. Soma analysis\steps\46b-prod-marekebisho-andika.log na umalize 46b kwanza. 43 haijaendeshwa.
  goto end
)
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
set "KUENDELEA="
for /f "usebackq tokens=1" %%t in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do if exist analysis\steps\43-prod-hali-%%t.json set "KUENDELEA=1"
if defined KUENDELEA echo KUENDELEA: andika ilishaanza leo - dirisha la saa halitumiki kwa kuendelea >> %L%
set "SAA="
for /f "usebackq tokens=2" %%t in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do set "SAA=%%t"
set "SAWA="
if "%SAA%" GEQ "0230" if "%SAA%" LEQ "0559" set "SAWA=1"
if "%DIRISHA%"=="ASUBUHI" if "%SAA%" GEQ "0600" if "%SAA%" LEQ "1100" set "SAWA=1"
if "%DIRISHA%"=="JIONI" if "%TAREHE_EAT%"=="2026-10-22" if "%SAA%" GEQ "1600" if "%SAA%" LEQ "2100" set "SAWA=1"
echo saa ya Tanzania %SAA% - dirisha %DIRISHA% - mwisho wa asubuhi 1100, mwisho wa jioni ya 2026-10-22 2100 >> %L%
if defined KUENDELEA set "SAWA=1"
if not defined SAWA (
  echo ---IMEKATALIWA: nje ya dirisha - saa %SAA% EAT, dirisha %DIRISHA% - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: saa %SAA% EAT iko nje ya dirisha. Usiku 02:30-05:59, au asubuhi 06:00-1100 kwa kibali, au jioni ya 2026-10-22 1600-2100 kwa kibali JIONI-20261022. 43 haijaendeshwa.
  goto end
)
if not defined PROD_API set "PROD_API=https://elikom.co.tz"
echo PROD_API=%PROD_API% >> %L%
set "CEO_EMAIL="
set /p CEO_EMAIL=Email ya akaunti yako ya CEO ya PROD - si root@system.com: 
if not defined CEO_EMAIL (
  echo ---EMAIL-HAIKUANDIKWA: hakuna kilichotumwa--- >> %L%
  set STEP=EMAIL-HAIKUANDIKWA
  set RC=1
  goto fail
)
if /i "%CEO_EMAIL%"=="root@system.com" (
  echo ---IMEKATALIWA: root@system.com ni ROOT - marekebisho ya prod ni kwa akaunti ya CEO--- >> %L%
  set STEP=AKAUNTI-YA-ROOT
  set RC=1
  goto fail
)
if /i "%CEO_EMAIL%"=="admin@admin.com" (
  echo ---IMEKATALIWA: admin@admin.com ni ROOT - marekebisho ya prod ni kwa akaunti ya CEO--- >> %L%
  set STEP=AKAUNTI-YA-ROOT
  set RC=1
  goto fail
)
echo email iliyoandikwa: %CEO_EMAIL% >> %L%
set "CEO_PASS="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya PROD ya akaunti hiyo - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "CEO_PASS=%%p"
if not defined CEO_PASS (
  echo ---PASSWORD-HAIKUANDIKWA: hakuna kilichotumwa--- >> %L%
  set STEP=PASSWORD-HAIKUANDIKWA
  set RC=1
  goto fail
)
set TARGET=prod
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "K46="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$m = @(Select-String -LiteralPath 'analysis\steps\46a-prod-marekebisho-kagua.log' -CaseSensitive -Pattern '^SAA_YA_SERVER_KUANZA (\S+)\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); if ($m.Count -eq 1 -and $m[0] -cmatch '^\d{9,11}$') { $m[0] } else { 'KOSA:' + ($m -join ',') }"`) do set "K46=%%v"
if not defined K46 set "K46=KOSA:"
echo SAA_YA_SERVER_KUANZA kutoka 46a: %K46% >> %L%
if "%K46:~0,5%"=="KOSA:" (
  echo SIYO: SAA_YA_SERVER_KUANZA kwenye analysis\steps\46a-prod-marekebisho-kagua.log haipo, si moja, au muundo wake si sahihi >> %L%
  set STEP=46A-SAA-YA-SERVER-KUANZA
  set RC=1
  goto fail
)
set STEP=KINGA-SCRIPT-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\45-maandishi.sh contabo:/tmp/45-maandishi.sh >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=MAANDISHI-TANGU-46A-LAZIMA-0
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/45-maandishi.sh %K46% %K46%; R=$?; rm -f /tmp/45-maandishi.sh; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\43-m7-prod.log" NGINX_LOG_INAFANYA_KAZI
if not defined NIMEPATA (
  echo SIYO: ombi la majaribio halikuonekana kwenye log ya nginx >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\43-m7-prod.log" MAANDISHI_TANGU_DUMP_HAKUNA
if not defined NIMEPATA (
  echo SIYO: kuna maombi ya kuandika tangu 46a ianze - SIMAMA, hakuna kilichoandikwa; orodha iko kwenye log >> %L%
  set RC=1
  goto fail
)
set STEP=KAGUA-HAIANDIKI
echo ---%STEP%--- >> %L%
node analysis\steps\43-m7-prod.mjs kagua >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
type %L%
set "JIBU="
set /p JIBU=Andika andika kuandika journals 2 za M-7 kwenye PROD - kingine chochote = simama: 
if /i not "%JIBU%"=="andika" (
  echo ---IMESIMAMISHWA-NA-MMILIKI: hakuna kilichoandikwa--- >> %L%
  set STEP=MMILIKI-AMESIMAMISHA
  set RC=1
  goto fail
)
echo mmiliki ameandika: andika >> %L%
set "K46="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$m = @(Select-String -LiteralPath 'analysis\steps\46a-prod-marekebisho-kagua.log' -CaseSensitive -Pattern '^SAA_YA_SERVER_KUANZA (\S+)\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); if ($m.Count -eq 1 -and $m[0] -cmatch '^\d{9,11}$') { $m[0] } else { 'KOSA:' + ($m -join ',') }"`) do set "K46=%%v"
if not defined K46 set "K46=KOSA:"
echo SAA_YA_SERVER_KUANZA kutoka 46a: %K46% >> %L%
if "%K46:~0,5%"=="KOSA:" (
  echo SIYO: SAA_YA_SERVER_KUANZA kwenye analysis\steps\46a-prod-marekebisho-kagua.log haipo, si moja, au muundo wake si sahihi >> %L%
  set STEP=46A-SAA-YA-SERVER-KUANZA
  set RC=1
  goto fail
)
set STEP=KINGA-SCRIPT-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\45-maandishi.sh contabo:/tmp/45-maandishi.sh >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=MAANDISHI-TANGU-46A-LAZIMA-0
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/45-maandishi.sh %K46% %K46%; R=$?; rm -f /tmp/45-maandishi.sh; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\43-m7-prod.log" NGINX_LOG_INAFANYA_KAZI
if not defined NIMEPATA (
  echo SIYO: ombi la majaribio halikuonekana kwenye log ya nginx >> %L%
  set RC=1
  goto fail
)
set "NIMEPATA="
call :mstari_pekee "analysis\steps\43-m7-prod.log" MAANDISHI_TANGU_DUMP_HAKUNA
if not defined NIMEPATA (
  echo SIYO: kuna maombi ya kuandika tangu 46a ianze - SIMAMA, hakuna kilichoandikwa; orodha iko kwenye log >> %L%
  set RC=1
  goto fail
)
set STEP=ANDIKA
echo ---%STEP%--- >> %L%
node analysis\steps\43-m7-prod.mjs andika >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "SAA2="
for /f "usebackq tokens=2" %%t in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do set "SAA2=%%t"
if not "%DIRISHA%"=="JIONI" if "%SAA2%" GTR "1145" echo ONYO: saa %SAA2% EAT - hatua hii haijaisha kabla ya 11:45; LSMS inarudi kutumika 12:00. Mwambie mmiliki SASA. >> %L%
if not "%DIRISHA%"=="JIONI" if "%SAA2%" GTR "1145" echo ONYO: saa %SAA2% EAT - hatua hii haijaisha kabla ya 11:45; LSMS inarudi kutumika 12:00.
set "SAA2="
for /f "usebackq tokens=2" %%t in (`powershell -NoProfile -Command "[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow, 'E. Africa Standard Time').ToString('yyyy-MM-dd HHmm')"`) do set "SAA2=%%t"
if "%DIRISHA%"=="JIONI" if "%SAA2%" GTR "2145" echo ONYO: saa %SAA2% EAT - hatua hii haijaisha kabla ya 21:45 ^(dirisha la jioni^). Mwambie mmiliki SASA. >> %L%
if "%DIRISHA%"=="JIONI" if "%SAA2%" GTR "2145" echo ONYO: saa %SAA2% EAT - hatua hii haijaisha kabla ya 21:45 ^(dirisha la jioni^). Mwambie mmiliki SASA.
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/45-maandishi.sh" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - M-7 imeandikwa kwenye PROD na inalingana na mazoezi. Matokeo: %L%. Sasa unaweza kuendesha 47 (kufunga Jan-Sep).
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Kama ANDIKA ilianza, nitumie log mara moja kabla ya kuendelea.
:end
set CEO_PASS=
set ROOT_PASS=
set PGPASSWORD=
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
