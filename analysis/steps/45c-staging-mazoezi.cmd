@echo off
rem HATUA 45c - MAZOEZI YA §1.8, SEHEMU 2: INABADILISHA STAGING TU (kupitia API ya staging, localhost:8081).
rem Inaendesha kwenye staging scripts ZILEZILE za prod, kwa mpangilio wa prod, kwa akaunti yako ya CEO:
rem   46-marekebisho.mjs kagua + andika (H-2, H-1, Q9 kwenda 2900), 43-m7-prod.mjs kagua + andika (M-7),
rem   47-funga-jan-sep.mjs kagua + andika (kufunga Jan-Sep). Kila moja inahifadhi namba zake 45-mazoezi\*.json;
rem   hatua za prod (46a, 46b, 43, 47) zinasimama zikikuta namba za prod hazilingani na hizi.
rem Akaunti: email na password ya akaunti yako ya CEO ya PROD (staging ni nakala ya dump mpya ya 45a, kwa hiyo ni zilezile).
rem Lazima kwanza: dirisha jingine lenye analysis\steps\tunnel.cmd likiwa wazi (localhost:8081 -^> staging).
rem Kinga: inakataa kuanza ikiwa log ya 45b haiishii ---OK---.
rem Matokeo: analysis\steps\45c-staging-mazoezi.log na analysis\steps\45-mazoezi\*.json
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
set L=analysis\steps\45c-staging-mazoezi.log
set STEP=
set RC=
echo ---MWENDESHO-45c--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\45b-staging-mazoezi-db.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya hatua 45b haiishii ---OK--- - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: hatua 45b haikuisha na ---OK---. Soma analysis\steps\45b-staging-mazoezi-db.log na umalize 45b kwanza. 45c haijaendeshwa.
  goto end
)
if exist analysis\steps\45-mazoezi\*.json (
  echo ---IMEKATALIWA: 45-mazoezi ina json za jaribio lililopita - staging huenda imeandikwa nusu--- >> %L%
  echo IMEKATALIWA: 45c ilishaanza mara moja - staging huenda imeandikwa nusu. Endesha 45b TENA - inarejesha staging na kufuta json - kisha 45c.
  goto end
)
set STEP=TUNNEL-LAZIMA-400
echo ---%STEP%--- >> %L%
curl -s -o nul -w "%%{http_code}" -X POST -H "Content-Type: application/json" -d "{}" http://localhost:8081/api/auth/login > analysis\steps\45c-tunnel.txt 2>&1
type analysis\steps\45c-tunnel.txt >> %L%
echo. >> %L%
set "NIMEPATA="
call :mstari_pekee "analysis\steps\45c-tunnel.txt" 400
if not defined NIMEPATA (
  echo SIYO: tunnel haijibu 400 - fungua analysis\steps\tunnel.cmd >> %L%
  set RC=1
  goto fail
)
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
set TARGET=staging
set API=http://localhost:8081
set STEP=MAZOEZI-46-KAGUA
echo ---%STEP%--- >> %L%
node analysis\steps\46-marekebisho.mjs kagua >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=MAZOEZI-46-ANDIKA
echo ---%STEP%--- >> %L%
node analysis\steps\46-marekebisho.mjs andika >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=MAZOEZI-43-KAGUA
echo ---%STEP%--- >> %L%
node analysis\steps\43-m7-prod.mjs kagua >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=MAZOEZI-43-ANDIKA
echo ---%STEP%--- >> %L%
node analysis\steps\43-m7-prod.mjs andika >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=MAZOEZI-47-KAGUA
echo ---%STEP%--- >> %L%
node analysis\steps\47-funga-jan-sep.mjs kagua >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=MAZOEZI-47-ANDIKA
echo ---%STEP%--- >> %L%
node analysis\steps\47-funga-jan-sep.mjs andika >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
if not exist analysis\steps\45-mazoezi\marekebisho-kagua.json (
  echo SIYO: marekebisho-kagua.json haipo >> %L%
  set STEP=MAZOEZI-marekebisho-kagua
  set RC=1
  goto fail
)
if not exist analysis\steps\45-mazoezi\marekebisho-andika.json (
  echo SIYO: marekebisho-andika.json haipo >> %L%
  set STEP=MAZOEZI-marekebisho-andika
  set RC=1
  goto fail
)
if not exist analysis\steps\45-mazoezi\m7-kagua.json (
  echo SIYO: m7-kagua.json haipo >> %L%
  set STEP=MAZOEZI-m7-kagua
  set RC=1
  goto fail
)
if not exist analysis\steps\45-mazoezi\m7-andika.json (
  echo SIYO: m7-andika.json haipo >> %L%
  set STEP=MAZOEZI-m7-andika
  set RC=1
  goto fail
)
if not exist analysis\steps\45-mazoezi\funga-kagua.json (
  echo SIYO: funga-kagua.json haipo >> %L%
  set STEP=MAZOEZI-funga-kagua
  set RC=1
  goto fail
)
if not exist analysis\steps\45-mazoezi\funga-andika.json (
  echo SIYO: funga-andika.json haipo >> %L%
  set STEP=MAZOEZI-funga-andika
  set RC=1
  goto fail
)
dir /b analysis\steps\45-mazoezi >> %L%
echo ---OK--- >> %L%
echo OK - mazoezi ya staging yamepita: marekebisho, M-7 na kufunga Jan-Sep; namba ziko 45-mazoezi. Matokeo: %L%. Sasa unaweza kuendesha 45d (deploy ya prod).
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Prod haijaguswa. Nitumie log.
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
