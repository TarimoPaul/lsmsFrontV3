@echo off
rem HATUA 63 - JAGGER MASTER (mmiliki 01/11 bo). INABADILISHA PRODUCTION (journal moja + gharama ya bidhaa moja).
rem   Tatizo: 11/10 carton ya chupa 6 (53,000) iliingizwa kama chupa 1 kwa 53,000; hesabu ya 13/10 iliongeza +5 x 53,000.
rem   HAIENDESHWI kabla ya log ya 62: inakataa mpaka analysis\steps\62-kagua-ufutaji.log iishe kwa ---OK---.
rem   MARA YA KWANZA: KAGUA (haiandiki, hakuna password): SQL ya kusoma tu kwenye prod -^> kiasi kwa njia mbili (A = thamani
rem     iliyobaki kwenye 1200 kutoka manunuzi/hesabu/mauzo, B = chupa x tofauti ya gharama; lazima zilingane), mauzo ya
rem     Jagger tangu 11/10 (siku, chupa, COGS) -^> ---SIMAMA-PREVIEW---. Nitumie log; USIANDIKE mpaka nikuthibitishie.
rem   MARA YA PILI: andika ANDIKA -^> email + password ya CEO (si root) -^> kagua upya (namba lazima ziwe zilezile, vinginevyo
rem     SIMAMA) -^> journal 01/11 Dr 5100 / Cr 1200 kupitia API (inarukwa ikiwa ipo) -^> gharama ya Jagger -^> 8,833.33 kwa SQL
rem     (transaction moja, ikiwa gharama na stock bado ni za preview; inarukwa ikiwa tayari) -^> ukaguzi: journal mara moja,
rem     thamani = chupa x 8,833.33, delta ya TB 5100/1200 tu, TB 0 -^> ---OK---. Ikirudiwa baada ya kukatika: inaendelea.
rem   Iendeshwe kabla duka halijaanza kuuza ikiwezekana: mauzo ya Jagger kati ya KAGUA na ANDIKA yanasimamisha hatua (salama).
rem Matokeo: analysis\steps\63-rekebisha-jagger.log. Kila output ya Contabo inapita ficha.awk kwenye server.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\63-rekebisha-jagger.log
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-63--- > %L%
set "NIMEPATA="
call :mwisho_ni "analysis\steps\62-kagua-ufutaji.log" ---OK---
if not defined NIMEPATA (
  echo ---IMEKATALIWA: log ya 62 haipo au haiishi kwa ---OK--- - endesha 62 kwanza na unitumie log--- >> %L%
  echo IMEKATALIWA - endesha 62 kwanza ^(log yake lazima iishe kwa ---OK---^). Hakuna kilichoendeshwa.
  goto end
)
echo log ya 62 imekamilika ---OK--- >> %L%
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
if not exist analysis\steps\63-kagua-prod.json goto kagua
set "JIBU="
set /p JIBU=Andika ANDIKA kurekebisha Jagger kwenye PROD (baada ya Claude kuthibitisha preview), KAGUA = kagua upya, kingine = simama:
if /i "%JIBU%"=="KAGUA" goto kagua
if not "%JIBU%"=="ANDIKA" (
  echo ---IMESIMAMISHWA-NA-MMILIKI: hakuna kilichoandikwa--- >> %L%
  echo IMESIMAMISHWA - hakuna kilichoandikwa.
  goto safisha
)
echo mmiliki ameandika: ANDIKA >> %L%
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
node analysis\steps\63-rekebisha-jagger.mjs andika >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"MUHTASARI 63 jagger andika" %L% | findstr /c:"FAIL 0," > nul
if errorlevel 1 (
  echo SIYO: MUHTASARI ya andika si FAIL 0 >> %L%
  set RC=1
  goto fail
)
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - PROD: Jagger imerekebishwa na kukaguliwa. Matokeo: %L%. Nitumie log.
goto end
:kagua
set STEP=KAGUA-HAIANDIKI
echo ---%STEP%--- >> %L%
node analysis\steps\63-rekebisha-jagger.mjs kagua >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"MUHTASARI 63 jagger kagua" %L% | findstr /c:"FAIL 0," > nul
if errorlevel 1 (
  echo SIYO: MUHTASARI ya kagua si FAIL 0 >> %L%
  set RC=1
  goto fail
)
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---SIMAMA-PREVIEW--- >> %L%
echo SIMAMA - preview ya Jagger iko kwenye %L%. Nitumie log. USIANDIKE ANDIKA mpaka Claude athibitishe; kisha endesha 63 tena.
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
