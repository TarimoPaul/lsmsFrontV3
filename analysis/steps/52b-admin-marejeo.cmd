@echo off
rem HATUA 52b - KUSOMA TU: rekodi zote zinazorejelea admin@admin.com (id / uid / email) kwenye nakala ya PC lsms_audit_^<leo^>_0200
rem   (ya 48 - si DB ya prod): FK kwenda users, safu za maandishi/uuid/json (kamili na ndani ya maandishi), na safu za namba zenye
rem   jina la mtumiaji. SQL: analysis\steps\52b-admin-marejeo.sql (BEGIN READ ONLY ... ROLLBACK).
rem   Matokeo: UAMUZI DELETE (marejeo 0) au UAMUZI TOMBSTONE (marejeo ^> 0) - 52c inausoma.
rem MPANGILIO (mmiliki 21/10 - SI LEO): 45i .env (22/10) -^> 2.2.72 kwenye prod (23/10) -^> 48 nakala ya 02:00 -^> 52b marejeo -^> 52c kuondoa admin.
rem   Kwa nini: DataInitializer ya 2.2.71 (DataInitializer.java:257-279) INAUNDA akaunti ya root.email upya kama ROOT (password ya
rem   ROOT_PASSWORD au default) ikiwa haipo. Kwa hiyo admin@admin.com isiondolewe kabla ya 2.2.72 na kabla ROOT_EMAIL haijarekebishwa.
rem Itakuuliza password ya Postgres ya PC (user postgres) - haionekani, haiandikwi.
rem Kinga: inakataa kuanza ikiwa log ya 45i au ya 48 haiishii ---OK---.
rem Matokeo: analysis\steps\52b-admin-marejeo.log
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
set L=analysis\steps\52b-admin-marejeo.log
set STEP=
set RC=
echo ---MWENDESHO-52b--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\45i-prod-env-root.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 45i haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 45i haikuisha na ---OK---. Soma analysis\steps\45i-prod-env-root.log na umalize 45i kwanza. 52b haijaendeshwa.
  goto end
)
set "NIMEPATA="
call :mwisho_ni "analysis\steps\48-ukaguzi-wa-ruhusa-42.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 48 haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 48 haikuisha na ---OK---. Soma analysis\steps\48-ukaguzi-wa-ruhusa-42.log na umalize 48 kwanza. 52b haijaendeshwa.
  goto end
)
set "D="
for /f "tokens=7" %%t in ('findstr /b /l /c:"tarehe ya 47: " analysis\steps\48-ukaguzi-wa-ruhusa-42.log') do set "D=%%t"
echo tarehe ya nakala kutoka 48: %D% >> %L%
echo %D%| findstr /r /x "20[0-9][0-9][01][0-9][0-3][0-9]" > nul
if errorlevel 1 (
  echo SIYO: tarehe ya nakala haikusomeka kutoka log ya 48 >> %L%
  set STEP=TAREHE-YA-48
  set RC=1
  goto fail
)
set "DB=lsms_audit_%D%_0200"
echo DB ya PC: %DB% >> %L%
set "PGPASSWORD="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya Postgres ya PC - user postgres - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "PGPASSWORD=%%p"
if not defined PGPASSWORD (
  echo ---PASSWORD-HAIKUANDIKWA: hakuna kilichotumwa--- >> %L%
  set STEP=PASSWORD-HAIKUANDIKWA
  set RC=1
  goto fail
)
set STEP=MAREJEO-YA-ADMIN-KUSOMA-TU
echo ---%STEP%--- >> %L%
set "PGOPTIONS=-c default_transaction_read_only=on"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -X -q -U postgres -d %DB% -At -v ON_ERROR_STOP=1 -f analysis\steps\52b-admin-marejeo.sql > analysis\steps\52b-matokeo.txt 2>&1
set RC=%errorlevel%
set "PGOPTIONS="
type analysis\steps\52b-matokeo.txt >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "U="
findstr /l /c:"UAMUZI_DELETE" analysis\steps\52b-matokeo.txt > nul && set "U=DELETE"
findstr /l /c:"UAMUZI_TOMBSTONE" analysis\steps\52b-matokeo.txt > nul && if defined U set "U=MBILI"
findstr /l /c:"UAMUZI_TOMBSTONE" analysis\steps\52b-matokeo.txt > nul && if not defined U set "U=TOMBSTONE"
findstr /l /c:"ADMIN_HAYUPO" analysis\steps\52b-matokeo.txt > nul && set "U=HAYUPO"
del /q analysis\steps\52b-matokeo.txt
if "%U%"=="HAYUPO" (
  echo SIYO: admin@admin.com haipo kwenye nakala %DB% - hakuna cha kuondoa, niambie >> %L%
  set RC=1
  goto fail
)
if not "%U%"=="DELETE" if not "%U%"=="TOMBSTONE" (
  echo SIYO: uamuzi haukusomeka: %U% >> %L%
  set RC=1
  goto fail
)
echo UAMUZI %U%>> %L%
set PGPASSWORD=
echo ---OK--- >> %L%
echo OK - marejeo ya admin@admin.com yamehesabiwa kwenye %DB%; UAMUZI %U%. Matokeo: %L%. Soma orodha ya MAREJEO, kisha 52c.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Hakuna kilichoandikwa. Nitumie log.
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
