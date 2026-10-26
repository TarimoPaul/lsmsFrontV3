@echo off
rem HATUA 56b - KUSOMA TU (mmiliki 26/10 e): ufafanuzi wa ALAMA za 56 (HITIMISHO ORODHA) kabla ya uamuzi wa 55.
rem   1) majina ya role 72a69af7... na ruhusa c4cd5cc6... (imeondolewa), 5503a8cd... / aab047bd... (zimeongezwa) - prod na dump ya 45a;
rem   2) nginx 21/10 11:53 -^> 15:13: kila ombi la kuandika kwenye usimamizi (users, roles, permissions, permission-config,
rem      business-settings, settings-approvals, gl periods/corrections, capital);
rem   3) KILA ombi la 51.158.200.198, 51.158.202.198 na 41.59.11.110 (saa, method, njia, HTTP, UA kamili, referer);
rem   4) IP zote zisizo za mmiliki/server/probe: ombi lolote (hata GET) kwenye usimamizi 21/10 11:53 -^> 26/10 09:20 (admin ilikuwa ACTIVE tayari 12:57:05, 45g log:34-38);
rem   5) kila login ya 154.74.x, 41.59.11.110 (na 51.158.x): kurasa 12 za kwanza ndani ya dak 20 - MFANYAKAZI au USIMAMIZI;
rem   6) kila ALAMA ya 56 = INAELEWEKA ^<sababu^> au HAIELEWEKI (kanuni ziko kwenye script). 55 inabaki imefungwa.
rem Server: analysis\steps\56b-admin-tukio-ufafanuzi.sh. Hakuna restart, hakuna kuandika, hakuna password.
rem Matokeo: analysis\steps\56b-prod-admin-tukio-ufafanuzi.log. Kila output ya Contabo inapita ficha.awk kwenye server.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\56b-prod-admin-tukio-ufafanuzi.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-56b--- > %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\56b-admin-tukio-ufafanuzi.sh contabo:/tmp/56b-admin-tukio-ufafanuzi.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=USHAHIDI-KUSOMA-TU
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/56b-admin-tukio-ufafanuzi.sh; R=$?; rm -f /tmp/56b-admin-tukio-ufafanuzi.sh; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\56b-prod-admin-tukio-ufafanuzi.log" ---USHAHIDI_56B_UMEKAMILIKA---
if not defined NIMEPATA (
  echo SIYO: script ya server haikumaliza >> %L%
  set RC=1
  goto fail
)
set "H56B="
for /f "tokens=2" %%h in ('findstr /b /c:"HITIMISHO_56B " %L%') do set "H56B=%%h"
if not defined H56B (
  echo SIYO: hakuna mstari wa HITIMISHO_56B >> %L%
  set STEP=HAKUNA-HITIMISHO
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - 56b imekamilika: HITIMISHO_56B %H56B%. Matokeo: %L%. Nitumie log hii. 55 inabaki imefungwa mpaka uamue.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/56b-admin-tukio-ufafanuzi.sh" >> %L% 2>&1
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
