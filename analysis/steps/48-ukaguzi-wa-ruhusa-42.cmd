@echo off
rem HATUA 48 = 42 YA MPANGO 1.8 (KUSOMA TU): ukaguzi wa ruhusa kwenye dump ya usiku UNAOFUATA hatua 47 - si DB ya prod.
rem   Endesha KESHO baada ya backup ya 02:00 (dump ya leo lazima iwe ya tarehe ya baada ya 47).
rem   1) dump ya leo: sha256 ya Contabo = ya B2; scp kuja D:\MY PROJECT\DUKA PROJECT\backups\ na sha256 ya PC = ya Contabo;
rem   2) inarejeshwa kwenye Postgres ya PC kama lsms_audit_^<tarehe^>_0200_nusu, na INABADILISHWA JINA kuwa lsms_audit_^<tarehe^>_0200
rem      baada ya pg_restore kufaulu tu;
rem   KURUDIA baada ya kukatika: faili lililopo lenye sha256 sawa na Contabo linatumika (halipakuliwi tena); DB kamili iliyopo
rem   (bila _nusu) inatumika; faili lisilo kamili au DB ya _nusu = SIMAMA na amri ya kuifuta inaonyeshwa (hakuna kinachofutwa yenyewe).
rem   3) analysis\steps\42-finance-write-ukaguzi.sql (READ ONLY): FINANCE_WRITE ni ya role CEO tu, hakuna ruhusa ya mtu
rem      mmoja, na admin@admin.com ni INACTIVE.
rem Itakuuliza password ya Postgres ya PC (user postgres) - haionekani, haiandikwi.
rem Kinga: inakataa kuanza ikiwa log ya 47 haiishii ---OK---.
rem Matokeo: analysis\steps\48-ukaguzi-wa-ruhusa-42.log
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
set L=analysis\steps\48-ukaguzi-wa-ruhusa-42.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-48--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\47-prod-funga-jan-sep.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 47 haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 47 haikuisha na ---OK---. Soma analysis\steps\47-prod-funga-jan-sep.log na umalize 47 kwanza. 48 haijaendeshwa.
  goto end
)
set STEP=KICHUJIO-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "T47="
for /f "tokens=2" %%t in ('findstr /b /l /c:"TAREHE_YA_47 " analysis\steps\47-prod-funga-jan-sep.log') do set "T47=%%t"
set "D="
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd"') do set "D=%%t"
echo tarehe ya 47: %T47% / leo: %D% >> %L%
if not defined T47 (
  echo SIYO: log ya 47 haina TAREHE_YA_47 >> %L%
  set STEP=TAREHE
  set RC=1
  goto fail
)
if %D% LEQ %T47% (
  echo SIYO: dump ya leo si ya baada ya 47 - endesha kesho baada ya 02:30 >> %L%
  set STEP=TAREHE
  set RC=1
  goto fail
)
set "J=lsms_%D%_0200.dump"
set "DB=lsms_audit_%D%_0200"
set STEP=SHA256-CONTABO-NA-B2
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { ls -l ~/backups/daily/%J% && sha256sum ~/backups/daily/%J% | cut -d' ' -f1 | sed 's/^/contabo /' && rclone cat b2:elikom-lsms-backups/daily/%J% | sha256sum | cut -d' ' -f1 | sed 's/^/b2 /' && [ $(sha256sum ~/backups/daily/%J% | cut -d' ' -f1) = $(rclone cat b2:elikom-lsms-backups/daily/%J% | sha256sum | cut -d' ' -f1) ] && echo SHA_CONTABO_B2_SAWA; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\48-ukaguzi-wa-ruhusa-42.log" SHA_CONTABO_B2_SAWA
if not defined NIMEPATA (
  echo SIYO: sha256 ya Contabo na B2 si sawa >> %L%
  set RC=1
  goto fail
)
set "CSHA="
for /f "tokens=2" %%h in ('findstr /b /l /c:"contabo " %L%') do set "CSHA=%%h"
echo sha256 ya Contabo kutoka log: %CSHA% >> %L%
if not defined CSHA (
  echo SIYO: sha256 ya Contabo haikusomeka >> %L%
  set STEP=SHA-CONTABO
  set RC=1
  goto fail
)
set STEP=FAILI-LA-PC-KURUDIA
echo ---%STEP%--- >> %L%
set "PSHA="
if exist "D:\MY PROJECT\DUKA PROJECT\backups\%J%" call :sha_pc
if defined PSHA echo faili lipo kwenye PC, sha256 %PSHA% >> %L%
if defined PSHA if not "%PSHA%"=="%CSHA%" (
  echo SIYO: D:\MY PROJECT\DUKA PROJECT\backups\%J% lipo lakini SI KAMILI - lifute kwa: del "D:\MY PROJECT\DUKA PROJECT\backups\%J%" - kisha endesha 48 tena >> %L%
  set RC=1
  goto fail
)
if defined PSHA echo faili kamili lilishapakuliwa - halipakuliwi tena >> %L%
if defined PSHA goto faili_lipo
scp %SSHO% contabo:backups/daily/%J% "D:\MY PROJECT\DUKA PROJECT\backups\%J%" >> %L% 2>&1
:faili_lipo
set "PSHA="
call :sha_pc
echo sha256 ya PC %PSHA% >> %L%
if not "%PSHA%"=="%CSHA%" (
  echo SIYO: sha256 ya PC si ya Contabo >> %L%
  set RC=1
  goto fail
)
set "PGPASSWORD="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya Postgres ya PC - user postgres - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "PGPASSWORD=%%p"
if not defined PGPASSWORD (
  echo ---PASSWORD-HAIKUANDIKWA: hakuna kilichotumwa--- >> %L%
  set STEP=PASSWORD-HAIKUANDIKWA
  set RC=1
  goto fail
)
set STEP=DB-YA-PC-HALI
echo ---%STEP%--- >> %L%
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -X -q -U postgres -d postgres -At -c "select count(*) from pg_database where datname = '%DB%_nusu'" > analysis\steps\48-db-nusu.txt 2>&1
set RC=%errorlevel%
type analysis\steps\48-db-nusu.txt >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\48-db-nusu.txt" 0
if not defined NIMEPATA (
  echo SIYO: %DB%_nusu ipo - restore ya jaribio lililopita haikuisha. Ifute: dropdb -U postgres %DB%_nusu - kisha endesha 48 tena >> %L%
  set RC=1
  goto fail
)
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -X -q -U postgres -d postgres -At -c "select count(*) from pg_database where datname = '%DB%'" > analysis\steps\48-db.txt 2>&1
set RC=%errorlevel%
type analysis\steps\48-db.txt >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "DBIPO=1"
set "NIMEPATA="
call :mstari_pekee "analysis\steps\48-db.txt" 0
if defined NIMEPATA set "DBIPO="
if defined DBIPO echo %DB% ilishakamilika kwenye jaribio lililopita - restore inarukwa >> %L%
set STEP=RESTORE-PC
echo ---%STEP%--- >> %L%
if defined DBIPO goto restore_imeruka
"C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres %DB%_nusu >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
"C:\Program Files\PostgreSQL\17\bin\pg_restore.exe" -U postgres -d %DB%_nusu --no-owner --exit-on-error "D:\MY PROJECT\DUKA PROJECT\backups\%J%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -X -q -U postgres -d postgres -v ON_ERROR_STOP=1 -c "ALTER DATABASE %DB%_nusu RENAME TO %DB%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
:restore_imeruka
set STEP=42-FINANCE-WRITE-UKAGUZI-READ-ONLY
echo ---%STEP%--- >> %L%
set "PGOPTIONS=-c default_transaction_read_only=on"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -X -q -U postgres -d %DB% -At -v ON_ERROR_STOP=1 -f analysis\steps\42-finance-write-ukaguzi.sql >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "PGOPTIONS="
findstr /b /l /c:"FW_ROLE_COUNT_MUST_BE_1|1" analysis\steps\48-ukaguzi-wa-ruhusa-42.log > nul
if errorlevel 1 (
  echo SIYO: FINANCE_WRITE haiko kwenye role 1 tu >> %L%
  set RC=1
  goto fail
)
findstr /b /l /c:"FW_USER_GRANTS_MUST_BE_0|0" analysis\steps\48-ukaguzi-wa-ruhusa-42.log > nul
if errorlevel 1 (
  echo SIYO: kuna ruhusa ya FINANCE_WRITE ya mtu mmoja >> %L%
  set RC=1
  goto fail
)
findstr /b /l /c:"FW_ROLES|CEO (" analysis\steps\48-ukaguzi-wa-ruhusa-42.log > nul
if errorlevel 1 (
  echo SIYO: FW_ROLES si CEO >> %L%
  set RC=1
  goto fail
)
findstr /b /l /c:"ROOT|admin@admin.com|status=INACTIVE" analysis\steps\48-ukaguzi-wa-ruhusa-42.log > nul
if errorlevel 1 (
  echo SIYO: admin@admin.com si INACTIVE kwenye dump >> %L%
  set RC=1
  goto fail
)
set PGPASSWORD=
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - ukaguzi wa 42 umepita kwenye %DB%: FINANCE_WRITE ni ya CEO tu, admin@admin.com INACTIVE. Matokeo: %L%.
goto end
:fail
set PGPASSWORD=
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Ikiwa ni muunganiko/umeme: endesha 48 tena - inaendelea pale ilipofika. Vinginevyo nitumie log.
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
:sha_pc
for /f "skip=1 tokens=1" %%h in ('certutil -hashfile "D:\MY PROJECT\DUKA PROJECT\backups\%J%" SHA256') do if not defined PSHA set "PSHA=%%h"
goto :eof
