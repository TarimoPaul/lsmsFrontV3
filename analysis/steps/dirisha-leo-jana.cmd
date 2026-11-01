@echo off
rem DIRISHA LA LEO/JANA (mmiliki 28/10 s, v) - KIOLEZO cha hatua za deploy za prod. Hakuna tarehe iliyoandikwa ndani.
rem   "leo"  = tarehe ya SERVER (Contabo, EAT). "jana" = leo - 1, inayohesabiwa na server (kwa reco).
rem   Saa ya kuanza: 06:00-11:00 EAT (si baada ya 11:00, rollback ipate nafasi). LSMS_DIRISHA=ASUBUHI + neno la kibali
rem   vinabaki kwa anayeiita (anaweka DIRISHA=ASUBUHI au HAKUNA kabla ya kuita).
rem Matumizi (bila setlocal; inatumia SSHO na F za anayeiita):
rem   call analysis\steps\dirisha-leo-jana.cmd "<log>"
rem   if not "%DLJ_SAWA%"=="1" ... SIMAMA ...
rem   node analysis\steps\46-reco-kinga.mjs %DLJ_JANA%
rem Inaweka: DLJ_SAWA=1 (au tupu), DLJ_LEO, DLJ_JANA (YYYY-MM-DD), DLJ_KOSA (sababu ikiwa si sawa).
rem Ishara za server (si mistari ya NAME=, ili ficha isiifiche): SIKU_LEO <tarehe>, SIKU_JANA <tarehe>, DIRISHA_SAWA.
set "DLJ_SAWA="
set "DLJ_LEO="
set "DLJ_JANA="
set "DLJ_KOSA="
set "DLJ_J="
if not defined DIRISHA set "DIRISHA=HAKUNA"
echo ---DIRISHA-LEO-JANA--- >> "%~1"
ssh %SSHO% -n contabo "set -o pipefail; { D=$(TZ=Africa/Dar_es_Salaam date +%%F) && N=$(TZ=Africa/Dar_es_Salaam date +%%H%%M) && J=$(TZ=Africa/Dar_es_Salaam date -d yesterday +%%F) && echo saa $D $N EAT dirisha %DIRISHA% && echo SIKU_LEO $D && echo SIKU_JANA $J && [ %DIRISHA% = ASUBUHI ] && [ $N -ge 0600 ] && [ $N -le 1100 ] && echo DIRISHA_SAWA; } 2>&1 | awk %F%" >> "%~1" 2>&1
for /f "usebackq tokens=1,2,3" %%a in (`powershell -NoProfile -Command "$l = Get-Content -LiteralPath '%~1'; $leo = @($l | Select-String -CaseSensitive -Pattern '^SIKU_LEO (\d{4}-\d{2}-\d{2})\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); $jana = @($l | Select-String -CaseSensitive -Pattern '^SIKU_JANA (\d{4}-\d{2}-\d{2})\s*$' | ForEach-Object { $_.Matches[0].Groups[1].Value } | Sort-Object -Unique); $ok = @($l | Select-String -CaseSensitive -Pattern '^DIRISHA_SAWA\s*$').Count; if ($leo.Count -ne 1 -or $jana.Count -ne 1) { 'KOSA SIKU_LEO_AU_SIKU_JANA_HAIPO_AU_SI_MOJA x' } elseif (([datetime]::ParseExact($leo[0], 'yyyy-MM-dd', $null)).AddDays(-1).ToString('yyyy-MM-dd') -ne $jana[0]) { 'KOSA JANA_SI_LEO_KASORO_SIKU_1 x' } elseif ($ok -ne 1) { 'NJE ' + $leo[0] + ' ' + $jana[0] } else { 'SAWA ' + $leo[0] + ' ' + $jana[0] }"`) do (
  set "DLJ_J=%%a"
  set "DLJ_LEO=%%b"
  set "DLJ_JANA=%%c"
)
if "%DLJ_J%"=="SAWA" set "DLJ_SAWA=1"
if "%DLJ_J%"=="NJE" set "DLJ_KOSA=nje ya dirisha - saa ya server si 06:00-11:00 EAT, au LSMS_DIRISHA/neno la kibali halikutolewa"
if "%DLJ_J%"=="KOSA" set "DLJ_KOSA=%DLJ_LEO%"
if "%DLJ_J%"=="KOSA" set "DLJ_LEO="
if "%DLJ_J%"=="KOSA" set "DLJ_JANA="
if not defined DLJ_J set "DLJ_KOSA=powershell haikusoma jibu la server"
if defined DLJ_SAWA echo DIRISHA_LEO_JANA_SAWA leo %DLJ_LEO% jana %DLJ_JANA% >> "%~1"
if not defined DLJ_SAWA echo DIRISHA_LEO_JANA_SIYO %DLJ_KOSA% >> "%~1"
set "DLJ_J="
