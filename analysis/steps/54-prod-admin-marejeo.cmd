@echo off
rem HATUA 54 - KUSOMA TU (mmiliki 22/10): marejeo YOTE (si audit tu) ya admin@admin.com - users.id=9, uid 5e0e9b5c..., email -
rem   kwenye DB ya prod, idadi kwa kila jedwali (roles.created_by, permissions, user_roles, ...), kabla ya uamuzi wa 52c.
rem   Server (analysis\steps\54-admin-marejeo.sh, kupitia ficha): 1) hali ya sasa ya admin@admin.com na root@system.com
rem   (analysis\steps\hali-root.sh prod SASA); 2) SQL ya 52b (analysis\steps\52b-admin-marejeo.sql): FK zote kwenda users
rem   (FK^|jedwali.safu^|idadi, hata 0), safu za maandishi/uuid/json, safu za namba zenye jina la mtumiaji = 9, jina 'System Root'
rem   (taarifa tu - admin na root wana jina hilo), JEDWALI^|jina^|idadi, na UAMUZI DELETE au TOMBSTONE.
rem DB ya prod KWA TRANSACTION YA READ ONLY tu (default_transaction_read_only=on + BEGIN READ ONLY ... ROLLBACK, statement_timeout
rem   120s) - ufikiaji uleule wa kusoma ambao mmiliki aliuruhusu wazi kwa 53. Hakuna restart, hakuna kuandika, hakuna password.
rem Matokeo: analysis\steps\54-prod-admin-marejeo.log
rem Kila sehemu inaandika [exit N]; stdout NA stderr ya kila amri ya Contabo zinapita kwenye ficha.awk KWENYE SERVER.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\54-prod-admin-marejeo.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
echo ---MWENDESHO-54--- > %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\hali-root.sh contabo:/tmp/hali-root.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\54-admin-marejeo.sh contabo:/tmp/54-admin-marejeo.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\52b-admin-marejeo.sql contabo:/tmp/54-admin-marejeo.sql >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=MAREJEO-KUSOMA-TU
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/54-admin-marejeo.sh; R=$?; rm -f /tmp/54-admin-marejeo.sh /tmp/54-admin-marejeo.sql /tmp/hali-root.sh; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\54-prod-admin-marejeo.log" ---USHAHIDI_54_UMEKAMILIKA---
if not defined NIMEPATA (
  echo SIYO: script ya server haikumaliza >> %L%
  set RC=1
  goto fail
)
findstr /l /c:"UAMUZI_" %L% > nul
if errorlevel 1 (
  echo SIYO: SQL haikutoa UAMUZI - soma makosa ya psql juu >> %L%
  set STEP=HAKUNA-UAMUZI
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - marejeo ya admin@admin.com kwa kila jedwali yako kwenye %L%. Nitumie log hii.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/hali-root.sh /tmp/54-admin-marejeo.sh /tmp/54-admin-marejeo.sql" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA kwenye %STEP% - soma %L%. Hakuna kilichobadilishwa. Nitumie log.
:end
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
