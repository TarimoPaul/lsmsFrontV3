@echo off
rem HATUA 61 - MALIPO YA AWAMU 1 YA MKOPO A KWENYE PROD (2.3.0): 386,000 CASH tarehe 03/11/2026. INABADILISHA PRODUCTION.
rem   (mmiliki 31/10 bh, na 28/10 u). API TU - hakuna ssh, hakuna query ya DB ya prod. Akaunti ya CEO yenye FINANCE_WRITE (si root).
rem   Endpoint: POST /api/v1/capital-monitoring/loans/INJ-0c98b69e.../repay - Dr 2100 / Cr 1000 (bank cut-over haijawekwa),
rem     awamu zinalipwa FIFO (awamu 1 -^> PAID). Backend haina dryRun wala kinga ya kurudia: kinga ziko kwenye 61-lipa-mkopo.mjs.
rem   MARA YA KWANZA: KAGUA (haiandiki) - mkopo A ACTIVE, deni 1,158,000, repaid 0, awamu 3 UNPAID, hakuna malipo/journal
rem     -^> inaonyesha kitakachoandikwa -^> ---SIMAMA-PREVIEW---. Nitumie log; USIANDIKE LIPA mpaka nikuthibitishie.
rem   MARA YA PILI (endesha 61 tena, tarehe 03/11 au baadaye, KAGUA ya siku hiyo hiyo): unaandika LIPA -^> POST moja
rem     -^> ukaguzi: deni 772,000, repaid 386,000, awamu 1 PAID, awamu 2-3 UNPAID, journal 03/11 Dr 2100 / Cr 1000 386,000,
rem     2100 +386,000, TB 0 -^> ---OK---.
rem   KUKATIKA: ikiwa malipo yameshaandikwa, 61 ikiendeshwa tena HAILIPI tena - inakagua tu. Ikiwa POST ilianza lakini
rem     haionekani -^> SIMAMA, nitumie log (usijaribu tena).
rem   Fedha (cj 03/11): 386,000 zililipwa 03/11 kutoka BAHASHA YA AKIBA (siyo droo) - kwenye vitabu ni 1000 (CASH ya biashara);
rem     reco ya droo ya 03/11 haiguswi. Kagua ya 02/11 (61-lipa-kagua.json) haitumiki: kagua mpya ni 61-lipa-kagua-0311.json.
rem   THIBITISHA (ck 03/11, KUSOMA TU - chaguo la kwanza, Enter): malipo YALIKUWA yameshaandikwa kabla ya 61. Inaonyesha malipo
rem     na journal zake (tarehe, mistari, riba, payment_method, posted_by, reference, created_at) -^> ---THIBITISHA-SAWA--- au
rem     ---THIBITISHA-INA-TOFAUTI--- pamoja na marekebisho yaliyoelezwa. Haiandiki chochote. Nitumie log.
rem Matokeo: analysis\steps\61-lipa-mkopo.log. Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\61-lipa-mkopo.log
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-61--- > %L%
set STEP=NODE
where node > nul 2>&1
if errorlevel 1 (
  set RC=1
  goto fail
)
set STEP=AKAUNTI-YA-CEO
echo ---%STEP%--- >> %L%
set TARGET=prod
if not defined PROD_API set "PROD_API=https://elikom.co.tz"
echo PROD_API ni %PROD_API% >> %L%
set "CEO_EMAIL="
set /p CEO_EMAIL=Email ya akaunti yako ya CEO ya PROD - si root:
if not defined CEO_EMAIL (
  set STEP=EMAIL-HAIKUANDIKWA
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
set "JIBU0="
set /p JIBU0=Enter = THIBITISHA malipo yaliyopo (kusoma tu). Andika KAGUA kwa kagua/lipa ya zamani:
if /i not "%JIBU0%"=="KAGUA" goto thibitisha
if not exist analysis\steps\61-lipa-kagua-0311.json goto kagua
set "JIBU="
set /p JIBU=Andika LIPA kuandika malipo ya 386,000 kwenye PROD (baada ya Claude kuthibitisha preview), KAGUA = kagua upya, kingine = simama:
if /i "%JIBU%"=="KAGUA" goto kagua
if not "%JIBU%"=="LIPA" (
  echo ---IMESIMAMISHWA-NA-MMILIKI: malipo hayajaandikwa--- >> %L%
  set STEP=MMILIKI-AMESIMAMISHA
  set RC=1
  goto fail
)
echo mmiliki ameandika: LIPA >> %L%
set STEP=LIPA
echo ---%STEP%--- >> %L%
node analysis\steps\61-lipa-mkopo.mjs lipa >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"MUHTASARI 61 lipa mkopo lipa" %L% | findstr /c:"FAIL 0," > nul
if errorlevel 1 (
  echo SIYO: MUHTASARI ya lipa si FAIL 0 >> %L%
  set RC=1
  goto fail
)
echo ---OK--- >> %L%
echo OK - PROD: malipo ya awamu 1 ya mkopo A ^(386,000 CASH, 03/11^) yameandikwa na kukaguliwa. Matokeo: %L%. Nitumie log.
goto end
:thibitisha
set STEP=THIBITISHA-KUSOMA-TU
echo ---%STEP%--- >> %L%
node analysis\steps\61-lipa-mkopo.mjs thibitisha >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
findstr /b /l /c:"MUHTASARI 61 lipa mkopo thibitisha" %L% | findstr /c:"FAIL 0," > nul
if errorlevel 1 goto thibitisha_tofauti
if not "%RC%"=="0" goto thibitisha_tofauti
echo ---THIBITISHA-SAWA--- >> %L%
echo THIBITISHA SAWA - malipo yaliyopo ni sahihi; hakuna kilichoandikwa. Matokeo: %L%. Nitumie log.
goto end
:thibitisha_tofauti
echo ---THIBITISHA-INA-TOFAUTI--- >> %L%
echo THIBITISHA INA TOFAUTI - marekebisho yameelezwa kwenye %L% (hakuna kilichoandikwa). USIENDESHE LIPA. Nitumie log.
goto end
:kagua
set STEP=KAGUA-HAIANDIKI
echo ---%STEP%--- >> %L%
node analysis\steps\61-lipa-mkopo.mjs kagua >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /b /l /c:"MUHTASARI 61 lipa mkopo kagua" %L% | findstr /c:"FAIL 0," > nul
if errorlevel 1 (
  echo SIYO: MUHTASARI ya kagua si FAIL 0 >> %L%
  set RC=1
  goto fail
)
echo ---SIMAMA-PREVIEW--- >> %L%
echo SIMAMA - preview ya malipo iko kwenye %L%. Nitumie log. USIANDIKE LIPA mpaka Claude athibitishe; kisha endesha 61 tena na uandike LIPA.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L% na unitumie. Usiendeshe LIPA tena mpaka nikague.
:end
set CEO_PASS=
set CEO_EMAIL=
endlocal
goto :eof
