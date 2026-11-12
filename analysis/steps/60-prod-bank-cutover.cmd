@echo off
rem (ff) 12/11: IMESTAAFU. D haiwekwi peke yake tena - tumia 60-ufunguzi.cmd (journal ya ufunguzi + D, kinga zilezile za 60-bank-cutover.sql).
echo IMESTAAFU: tumia analysis\steps\60-ufunguzi.cmd kagua / andika - hakuna kilichoendeshwa.
exit /b 2
rem HATUA 60 - TAREHE YA KUKATA D YA BENKI (mmiliki 28/10 x, S-A). IMEANDALIWA TU - HAIJAENDESHWA. INABADILISHA PROD (gl_config).
rem   Inaendeshwa SIKU YA KUKATA pamoja na journal ya ufunguzi, baada ya 2.3.0 kuwa prod. Hakuna restart: backend inasoma D kila malipo.
rem   Kuanzia D malipo ya mkopo ni Cr 102x iliyochaguliwa; kabla ya D ni Cr 1000 (M-13).
rem   set LSMS_CUTOVER_D=YYYY-MM-DD  kisha endesha hii; itakuuliza uandike kata.
rem   Kinga (ndani ya SQL, transaction moja - kosa lolote = hakuna kilichobadilika):
rem     D ^>= malipo ya mkopo ya mwisho (rekodi na journal); mwezi wa D haujafungwa; D iliyokwisha wekwa haibadilishwi
rem     (D ileile tena = CUTOVER_TAYARI, hakuna kinachobadilika); gl_config safu 1; UPDATE safu 1.
rem   Server: analysis\steps\60-bank-cutover.sh + 60-bank-cutover.sql. Log ya hatua hii NDIYO rekodi ya D.
rem Kila output ya Contabo inapita ficha.awk kwenye server. Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\60-prod-bank-cutover.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-60--- > %L%
set "DOK="
for /f "usebackq delims=" %%v in (`powershell -NoProfile -Command "$d = $env:LSMS_CUTOVER_D; if ($d -match '^\d{4}-\d{2}-\d{2}$') { try { [void][datetime]::ParseExact($d, 'yyyy-MM-dd', $null); 'SAWA' } catch { 'SIYO' } } else { 'SIYO' }"`) do set "DOK=%%v"
if not "%DOK%"=="SAWA" (
  echo ---IMEKATALIWA: LSMS_CUTOVER_D si tarehe YYYY-MM-DD - hakuna kilichoendeshwa--- >> %L%
  echo IMEKATALIWA: weka kwanza  set LSMS_CUTOVER_D=YYYY-MM-DD  - 60 haijaendeshwa.
  goto end
)
echo D iliyoombwa: %LSMS_CUTOVER_D% >> %L%
rem (bj) 01/11: cash count ya ufunguzi ya siku ya D lazima ihesabu pia bahasha ya akiba ya mkopo (pesa taslimu
rem iliyowekwa pembeni kulipa mkopo), vinginevyo 1000 ya ufunguzi inakosa pesa hiyo.
set "BAHASHA="
set /p BAHASHA=Cash count ya ufunguzi imehesabu BAHASHA YA AKIBA YA MKOPO? Andika bahasha - kingine chochote = simama:
if /i not "%BAHASHA%"=="bahasha" (
  echo ---IMESIMAMISHWA: bahasha ya akiba ya mkopo haijathibitishwa kwenye cash count ya ufunguzi - hakuna kilichobadilishwa--- >> %L%
  echo IMESIMAMISHWA - hesabu kwanza bahasha ya akiba ya mkopo kwenye cash count ya ufunguzi. Hakuna kilichobadilishwa.
  goto end
)
echo mmiliki amethibitisha: bahasha ya akiba ya mkopo imo kwenye cash count ya ufunguzi >> %L%
set "JIBU="
set /p JIBU=Andika kata kuweka D = %LSMS_CUTOVER_D% kwenye PROD - kingine chochote = simama:
if /i not "%JIBU%"=="kata" (
  echo ---IMESIMAMISHWA-NA-MMILIKI: hakuna kilichobadilishwa--- >> %L%
  echo IMESIMAMISHWA - hakuna kilichobadilishwa.
  goto end
)
echo mmiliki ameandika: kata >> %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\60-bank-cutover.sh contabo:/tmp/60-bank-cutover.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\60-bank-cutover.sql contabo:/tmp/60-bank-cutover.sql >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=WEKA-D-PROD
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/60-bank-cutover.sh prod %LSMS_CUTOVER_D%; R=$?; rm -f /tmp/60-bank-cutover.sh /tmp/60-bank-cutover.sql; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\60-prod-bank-cutover.log" ---60_MWISHO---
if not defined NIMEPATA (
  echo SIYO: script ya server haikumaliza >> %L%
  set RC=1
  goto fail
)
findstr /b /l /c:"CUTOVER_SASA %LSMS_CUTOVER_D%" %L% > nul
if errorlevel 1 (
  echo SIYO: log haina CUTOVER_SASA %LSMS_CUTOVER_D% >> %L%
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - D ya benki ni %LSMS_CUTOVER_D% kwenye prod. Matokeo: %L%. Nitumie log.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/60-bank-cutover.sh /tmp/60-bank-cutover.sql" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Nitumie log.
:end
endlocal
goto :eof
rem :mstari_pekee "<faili>" <neno> - NIMEPATA=1 ikiwa mstari fulani wa <faili> una <neno> PEKE YAKE.
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
