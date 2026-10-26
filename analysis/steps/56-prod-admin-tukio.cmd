@echo off
rem HATUA 56 - KUSOMA TU (mmiliki 26/10): je, admin@admin.com ilitumika ilipokuwa ACTIVE + is_root kwa password ya awali,
rem   2026-10-21 15:13:12 hadi 2026-10-26 09:20:46 EAT? Inaendeshwa KABLA ya 55 (55 inakataa bila 56 ya leo = HAKUNA_USHAHIDI_WA_MATUMIZI).
rem   Server (analysis\steps\56-admin-tukio.sh, kupitia ficha):
rem   a) log ya backend tangu 22/10 19:07 - admin@admin.com, login, authentication, BadCredentials, locked (saa na IP);
rem   b) nginx ya kipindi - POST /api/auth/login kwa IP, na kila ombi la kuandika kwenye users/roles/permissions/settings/
rem      gl periods/gl corrections/capital (IP, saa, HTTP); IP isiyo 41.59.106.20 = ALAMA;
rem   c) DB READ ONLY - users, roles, permission_config, role_permissions, user_roles, permissions, settings, business_settings,
rem      settings_approvals, user_branches zenye created_at/updated_at ndani ya kipindi;
rem   e) dump ya 45a (21/10 11:53, kabla ya 15:13) dhidi ya prod sasa: user_roles, role_permissions, user_branches, permission_config,
rem      roles, settings/business_settings - tofauti yoyote = ALAMA; hakuna = ushahidi mkuu E_HAKUNA_TOFAUTI_DUMP_VS_PROD;
rem   d) HITIMISHO HAKUNA_USHAHIDI_WA_MATUMIZI au HITIMISHO ORODHA. Ushahidi usiokamilika = ALAMA.
rem Hakuna restart, hakuna kuandika, hakuna password. Matokeo: analysis\steps\56-prod-admin-tukio.log
rem Kila sehemu inaandika [exit N]; stdout NA stderr ya kila amri ya Contabo zinapita kwenye ficha.awk KWENYE SERVER.
rem Ikishindwa: ---IMESHINDWA-KWENYE: ^<sehemu^> (exit N)--- kisha ---IMESHINDWA---.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\56-prod-admin-tukio.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
set SSHO=-o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=15 -o ServerAliveCountMax=4
set STEP=
set RC=
if exist %L% copy /y %L% %L%.awali > nul
echo ---MWENDESHO-56--- > %L%
set STEP=FAILI-KWENDA-CONTABO
echo ---%STEP%--- >> %L%
scp %SSHO% analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
if "%RC%"=="0" scp %SSHO% analysis\steps\56-admin-tukio.sh contabo:/tmp/56-admin-tukio.sh >> %L% 2>&1
if "%RC%"=="0" set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set STEP=USHAHIDI-KUSOMA-TU
echo ---%STEP%--- >> %L%
ssh %SSHO% -n contabo "set -o pipefail; { bash /tmp/56-admin-tukio.sh; R=$?; rm -f /tmp/56-admin-tukio.sh; exit $R; } 2>&1 | awk %F%" >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail
set "NIMEPATA="
call :mstari_pekee "analysis\steps\56-prod-admin-tukio.log" ---USHAHIDI_56_UMEKAMILIKA---
if not defined NIMEPATA (
  echo SIYO: script ya server haikumaliza >> %L%
  set RC=1
  goto fail
)
set "HITIMISHO="
for /f "tokens=2" %%h in ('findstr /b /c:"HITIMISHO " %L%') do set "HITIMISHO=%%h"
if not defined HITIMISHO (
  echo SIYO: hakuna mstari wa HITIMISHO >> %L%
  set STEP=HAKUNA-HITIMISHO
  set RC=1
  goto fail
)
echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
echo ---OK--- >> %L%
echo OK - 56 imekamilika: HITIMISHO %HITIMISHO%. Matokeo: %L%. Nitumie log hii; 55 inaendeshwa tu ikiwa ni HAKUNA_USHAHIDI_WA_MATUMIZI na nimeikagua.
goto end
:fail
echo ---IMESHINDWA-KWENYE: %STEP% (exit %RC%)--- >> %L%
ssh %SSHO% -n contabo "rm -f /tmp/ficha-lsms.awk /tmp/56-admin-tukio.sh" >> %L% 2>&1
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
