@echo off
rem HATUA 64 - MALIPO YA DENI YA 15/10 (mmiliki 02/11 bu). INABADILISHA PRODUCTION (journal 1 au 2; J2 pia daftari la madai).
rem   Chanzo: analysis\toleo2\RIPOTI-BT-02-11.md sehemu ya 2.
rem   HAIENDESHWI kabla ya 63: inakataa mpaka analysis\steps\63-rekebisha-jagger.log iishe kwa ---OK--- (63 ANDIKA imekamilika).
rem   MARA YA KWANZA: KAGUA (haiandiki, hakuna password): SQL ya kusoma tu kwenye prod -^> journal 4 za chanzo lazima ziwe
rem     kama kwenye nakala (JE-...6802 reco 10/10, JE-...7163 28,500, JE-...6819 15,000, JE-...1062 2,000), Oktoba wazi,
rem     1120 ya GL = daftari la madai, TB 0 -^> ---SIMAMA-PREVIEW---. Nitumie log; USIANDIKE mpaka nikuthibitishie.
rem   MARA YA PILI: andika ANDIKA -^> swali la J2 -^> email + password ya CEO (si root) -^> kagua upya (lazima ilingane na preview)
rem     -^> J1 15/10 Dr 6700 / Cr 1000 28,500 (daima)
rem     -^> J2 15/10 Dr 1120 / Cr 4000 17,000 TU ukiandika "J2 ndiyo"; pamoja nayo malipo 15,000 na 2,000 yanafutwa kwenye
rem         daftari la madai (SQL + audit_trails) ili 1120 ibaki = daftari. Jibu jingine lolote = J2 inarukwa.
rem     -^> ukaguzi: delta ya TB, kila journal mara moja, 1120 = daftari, TB 0 -^> ---OK---. Ikirudiwa baada ya kukatika: inaendelea.
rem Matokeo: analysis\steps\64-rekebisha-15-10.log. Kila output ya Contabo inapita ficha.awk kwenye server.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\64-rekebisha-15-10.log
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
set J2_NDIYO=0
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-64--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\63-rekebisha-jagger.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya 63 haipo au haiishi kwa ---OK--- - endesha 63 ANDIKA kwanza--- >> %L%
  echo IMEKATALIWA - 64 inaendeshwa baada ya 63 ^(log yake lazima iishe kwa ---OK---^). Hakuna kilichoendeshwa.
  goto end
)
echo log ya 63 imekamilika ---OK--- >> %L%
set STEP=NODE
where node > nul 2>&1
if errorlevel 1 (
  set RC=1
  goto fail
)
set TARGET=prod
if not defined PROD_API set "PROD_API=https://elikom.co.tz"
echo PROD_API ni %PROD_API% >> %L%
set STEP=FICHA-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
if not exist analysis\steps\64-kagua-prod.json goto kagua
set "JIBU="
set /p JIBU=Andika ANDIKA kurekebisha 15/10 kwenye PROD (baada ya Claude kuthibitisha preview), KAGUA = kagua upya, kingine = simama:
if /i "%JIBU%"=="KAGUA" goto kagua
if not "%JIBU%"=="ANDIKA" (
  echo ---IMESIMAMISHWA-NA-MMILIKI: hakuna kilichoandikwa--- >> %L%
  echo IMESIMAMISHWA - hakuna kilichoandikwa.
  goto safisha
)
echo mmiliki ameandika: ANDIKA >> %L%
set "J2JIBU="
set /p J2JIBU=J2 (Dr 1120 / Cr 4000 17,000 + kufuta malipo 15,000 na 2,000 kwenye daftari): andika  J2 ndiyo  kuiandika, kingine = ruka J2:
if "%J2JIBU%"=="J2 ndiyo" set J2_NDIYO=1
if "%J2_NDIYO%"=="1" (
  echo mmiliki ameandika: J2 ndiyo - J2 itaandikwa >> %L%
) else (
  echo J2 ITARUKWA - mmiliki hakuandika "J2 ndiyo" >> %L%
)
set STEP=AKAUNTI-YA-CEO
set "CEO_EMAIL="
set /p CEO_EMAIL=Email ya akaunti yako ya CEO ya PROD - si root:
if not defined CEO_EMAIL (
  set RC=1
  goto fail
)
if /i "%CEO_EMAIL%"=="root@system.com" (
  set STEP=ROOT-HAIRUHUSIWI
  set RC=1
  goto fail
)
echo email iliyoandikwa: %CEO_EMAIL% >> %L%
set "CEO_PASS="
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya PROD ya akaunti hiyo - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "CEO_PASS=%%p"
if not defined CEO_PASS (
  echo ---PASSWORD-HAIKUANDIKWA--- >> %L%
  set STEP=PASSWORD-HAIKUANDIKWA
  set RC=1
  goto fail
)
set STEP=ANDIKA
echo ---%STEP%--- >> %L%
node analysis\steps\64-rekebisha-15-10.mjs andika >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"MUHTASARI 64 15-10 andika" %L% | findstr /c:"FAIL 0," > nul
if errorlevel 1 (
  echo SIYO: MUHTASARI ya andika si FAIL 0 >> %L%
  set RC=1
  goto fail
)
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - PROD: 15/10 imerekebishwa na kukaguliwa. Matokeo: %L%. Nitumie log.
goto end
:kagua
set STEP=KAGUA-HAIANDIKI
echo ---%STEP%--- >> %L%
node analysis\steps\64-rekebisha-15-10.mjs kagua >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"MUHTASARI 64 15-10 kagua" %L% | findstr /c:"FAIL 0," > nul
if errorlevel 1 (
  echo SIYO: MUHTASARI ya kagua si FAIL 0 >> %L%
  set RC=1
  goto fail
)
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---SIMAMA-PREVIEW--- >> %L%
echo SIMAMA - preview ya 15/10 iko kwenye %L%. Nitumie log. USIANDIKE ANDIKA mpaka Claude athibitishe; kisha endesha 64 tena.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L% na unitumie. Usiendeshe ANDIKA tena mpaka nikague.
goto end
:safisha
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
:end
set CEO_PASS=
set CEO_EMAIL=
set J2_NDIYO=
endlocal
goto :eof
rem :mstari_pekee "<faili>" <neno> - NIMEPATA=1 ikiwa mstari fulani wa <faili> una <neno> PEKE YAKE, bila kujali
rem nafasi, tab au 
 (CRLF, LF, au bila mwisho wa mstari). Inachukua nafasi ya findstr /x, ambayo haioni mstari
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
rem (bila kujali nafasi, tab au 
). Faili lisilokuwepo = HAPANA.
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
