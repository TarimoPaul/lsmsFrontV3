@echo off
rem HATUA 71-db - DB za LSMS kwenye PostgreSQL ya LOCAL (PC hii, 5432) (mmiliki 29/10 ao, as.0c). Password ni yako (haionekani).
rem   1) KUSOMA TU: 71-db-soma.sql - ukubwa na miunganisho ya kila DB; DB 6 za kufuta lazima ziwe bila muunganisho
rem   2) pg_dump -Fc ya LocalLsms, LsmsAngular, Lsms -> D:\LSMS-ARCHIVE\db\<db>.dump, pg_restore --list, idadi ya majedwali ya DB
rem      = idadi ya TABLE DATA ya dump, sha256 -> db\SHA256SUMS.txt. Dump iliyopo tayari haiandikwi juu (inathibitishwa tu).
rem   3) KITUO: andika SAFISHA ili kuendelea (kitu kingine = simama)
rem   4) 71-db-drop.sql - DROP ya lsms_audit, lsms_audit_1004, lsms_toleo1_scratch, LocalLsms, LsmsAngular, Lsms (bila FORCE)
rem   BAKI: lsms_test_reco (dev), lsms_audit_20261015_0200, lsms_returns_scratch. Haigusi prod, staging, wala DB zisizo za LSMS.
rem Matokeo: analysis\steps\71-db.log
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\71-db.log
set "PGB=C:\Program Files\PostgreSQL\17\bin"
set "PGC=-h localhost -p 5432 -U postgres"
set "DD=D:\LSMS-ARCHIVE\db"
set "TMPD=%TEMP%\lsms-71db"
set STEP=
set RC=
set "JIBU="
set "PGPASSWORD="
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-71-DB--- > %L%
echo %date% %time% >> %L%
for /f usebackq^ delims^=^ eol^= %%p in (`powershell -NoProfile -Command "$s=Read-Host 'Password ya postgres ya PG ya LOCAL - herufi hazionekani' -AsSecureString; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }"`) do set "PGPASSWORD=%%p"
if not defined PGPASSWORD (
  echo ---PASSWORD-HAIKUANDIKWA--- >> %L%
  echo Password haikuandikwa - hakuna kilichoendeshwa.
  goto end
)
if not exist "%TMPD%" mkdir "%TMPD%"
set STEP=SOMA
echo ---%STEP%--- >> %L%
"%PGB%\psql.exe" -X %PGC% -d postgres -v ON_ERROR_STOP=1 -f analysis\steps\71-db-soma.sql > "%TMPD%\soma.txt" 2>&1
set RC=%errorlevel%
type "%TMPD%\soma.txt" >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
type "%TMPD%\soma.txt"
findstr /c:"MIUNGANISHO_KWENYE_ZA_KUFUTA 0" "%TMPD%\soma.txt" > nul
if errorlevel 1 (
  set STEP=KUNA-MUUNGANISHO-KWENYE-DB-YA-KUFUTA
  set RC=1
  goto fail
)
findstr /c:"DB_ZA_KUBAKI_ZILIZOPO 3" "%TMPD%\soma.txt" > nul
if errorlevel 1 (
  set STEP=DB-ZA-KUBAKI-HAZIPO-ZOTE-3
  set RC=1
  goto fail
)
if not exist "%DD%" mkdir "%DD%"
for %%d in (LocalLsms LsmsAngular Lsms) do (
  call :dump_db %%d
  if errorlevel 1 goto fail
)
echo ---DUMPS_ZOTE_3_SAWA--- >> %L%
type "%DD%\SHA256SUMS.txt" >> %L%
echo.
echo ======================== KITUO (STOP) ========================
echo Dumps ziko %DD% - pg_restore --list sawa, majedwali = TABLE DATA. DB isiyokuwepo imerukwa.
echo Zitafutwa (DROP) zilizopo kati ya: lsms_audit, lsms_audit_1004, lsms_toleo1_scratch, LocalLsms, LsmsAngular, Lsms.
echo Zinabaki: lsms_test_reco, lsms_audit_20261015_0200, lsms_returns_scratch. Ukubwa wa kila DB uko hapo juu.
echo Andika SAFISHA kisha Enter ili kuzifuta. Kitu kingine chochote = simama.
echo ===============================================================
set /p "JIBU=Jibu: "
if not "%JIBU%"=="SAFISHA" (
  echo ---IMESIMAMA-KWA-MMILIKI: hakuna DB iliyofutwa; dumps zinabaki--- >> %L%
  echo Umesimama. Hakuna DB iliyofutwa. Dumps zinabaki %DD%.
  goto end
)
echo ---MMILIKI-AMEANDIKA-SAFISHA %date% %time%--- >> %L%
set STEP=DROP
echo ---%STEP%--- >> %L%
"%PGB%\psql.exe" -X %PGC% -d postgres -v ON_ERROR_STOP=1 -f analysis\steps\71-db-drop.sql > "%TMPD%\drop.txt" 2>&1
set RC=%errorlevel%
type "%TMPD%\drop.txt" >> %L%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
findstr /c:"DROP_ZIMEKAMILIKA 6 kati ya 6" "%TMPD%\drop.txt" > nul
if errorlevel 1 (
  set STEP=ISHARA-DROP_ZIMEKAMILIKA
  set RC=1
  goto fail
)
findstr /c:"DB_ZA_KUBAKI_ZILIZOPO 3" "%TMPD%\drop.txt" > nul
if errorlevel 1 (
  set STEP=DB-ZA-KUBAKI-BAADA-YA-DROP
  set RC=1
  goto fail
)
echo ---OK--- >> %L%
echo OK - DB za kufuta hazipo tena, dumps ziko %DD%. Matokeo: %L%. Nitumie log.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Hakuna DB iliyofutwa kabla ya SAFISHA. Nitumie log.
:end
set "PGPASSWORD="
set "JIBU="
if exist "%TMPD%" rd /s /q "%TMPD%"
endlocal
goto :eof

rem :dump_db <db> - pg_dump -Fc (ikiwa haipo), pg_restore --list, majedwali = TABLE DATA, sha256. errorlevel 1 = imeshindwa.
:dump_db
set "STEP=PG_DUMP-%~1"
set "DF=%DD%\%~1.dump"
echo ---%STEP%--- >> %L%
rem DB isiyokuwepo (mf. Lsms: IntelliJ iliitaja DB ambayo haipo) haina cha ku-dump wala kufuta - inarukwa
"%PGB%\psql.exe" -X %PGC% -d postgres -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_database where datname = '%~1'" > "%TMPD%\%~1.ipo" 2>> %L%
if errorlevel 1 (
  set RC=1
  exit /b 1
)
set /p IPO=< "%TMPD%\%~1.ipo"
if "%IPO%"=="0" (
  echo HAIPO: DB %~1 haipo kwenye PG ya local - hakuna cha ku-dump, inarukwa >> %L%
  exit /b 0
)
if exist "%DF%" (
  echo %~1.dump ipo tayari - haiandikwi juu, inathibitishwa tu >> %L%
) else (
  "%PGB%\pg_dump.exe" %PGC% -d "%~1" -Fc -f "%DF%.tmp" >> %L% 2>&1
  if errorlevel 1 (
    set RC=1
    if exist "%DF%.tmp" del "%DF%.tmp"
    exit /b 1
  )
  move /y "%DF%.tmp" "%DF%" > nul
)
"%PGB%\pg_restore.exe" --list "%DF%" > "%TMPD%\%~1.list" 2>> %L%
if errorlevel 1 (
  set "STEP=PG_RESTORE_LIST-%~1"
  set RC=1
  exit /b 1
)
"%SystemRoot%\System32\find.exe" /c " TABLE DATA " < "%TMPD%\%~1.list" > "%TMPD%\%~1.ntd"
set /p NTD=< "%TMPD%\%~1.ntd"
"%PGB%\psql.exe" -X %PGC% -d "%~1" -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'r' and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg_toast%%' and n.nspname not like 'pg_temp%%'" > "%TMPD%\%~1.nt" 2>> %L%
if errorlevel 1 (
  set "STEP=IDADI_YA_MAJEDWALI-%~1"
  set RC=1
  exit /b 1
)
set /p NT=< "%TMPD%\%~1.nt"
echo %~1: majedwali %NT%, TABLE DATA %NTD% >> %L%
if not "%NT%"=="%NTD%" (
  set "STEP=MAJEDWALI-%~1-SI-SAWA-NA-DUMP"
  set RC=1
  exit /b 1
)
for /f "usebackq delims=" %%h in (`powershell -NoProfile -Command "(Get-FileHash -Algorithm SHA256 -LiteralPath '%DF%').Hash.ToLower()"`) do set "HSH=%%h"
rem "  <db>.dump" (nafasi mbili mbele): "Lsms.dump" peke yake ingelingana na "LocalLsms.dump" pia
findstr /c:"  %~1.dump" "%DD%\SHA256SUMS.txt" > nul 2>&1
if errorlevel 1 echo %HSH%  %~1.dump>> "%DD%\SHA256SUMS.txt"
findstr /c:"%HSH%  %~1.dump" "%DD%\SHA256SUMS.txt" > nul
if errorlevel 1 (
  set "STEP=SHA256-%~1-SI-SAWA-NA-SHA256SUMS"
  set RC=1
  exit /b 1
)
echo DUMP_SAWA %~1 %HSH% >> %L%
exit /b 0
