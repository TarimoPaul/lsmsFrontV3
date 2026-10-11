@echo off
rem HATUA 11 - PREFLIGHT YA PROD, KUSOMA TU: deploy\deploy-backend.ps1 -DeployOnly 2.2.66 -PreflightOnly
rem Inavuta image 2.2.66 kwenye PC hii, inasoma migrations ndani ya jar yake, inasoma hali ya prod (--status) na kusimama.
rem Hakuna deploy, hakuna swali. Kitu pekee kinachoandikwa kwenye Contabo ni nakala ya script /tmp/deploy-backend.sh.
rem Kisha inakagua log (kila sharti SAWA au SIYO):
rem   - digest ya image ni ile iliyojaribiwa staging: sha256:0cb30c4cf83da1bfd20ee380a8dfb61c10e9ad41bab8430ced8acc099b3b45e2
rem   - migrations zinazosubiri ni MBILI tu, V128 na V129
rem   - prod sasa inaendesha 2.2.65
rem Mstari wa mwisho uwe PREFLIGHT_SAWA; vinginevyo hatua ya 12 itakataa. Matokeo: analysis\steps\11-prod-preflight.log
setlocal
set "LOG=D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\11-prod-preflight.log"
set "DIGEST=sha256:0cb30c4cf83da1bfd20ee380a8dfb61c10e9ad41bab8430ced8acc099b3b45e2"
set "BAD=0"
cd /d "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms"
if errorlevel 1 goto fail
echo ---PREFLIGHT-ONLY-2.2.66--- > "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-backend.ps1 -DeployOnly 2.2.66 -PreflightOnly >> "%LOG%" 2>&1
if errorlevel 1 goto fail
echo ---MASHARTI--- >> "%LOG%"

findstr /c:"%DIGEST%" "%LOG%" > nul
if errorlevel 1 goto digest_bad
echo SAWA  digest: ni ile ya staging [%DIGEST%] >> "%LOG%"
goto digest_done
:digest_bad
echo SIYO  digest: [%DIGEST%] haimo kwenye preflight - image si ile iliyojaribiwa staging >> "%LOG%"
set "BAD=1"
:digest_done

findstr /c:"Server sasa: 2.2.65" "%LOG%" > nul
if errorlevel 1 goto run_bad
echo SAWA  prod inaendesha: [2.2.65] >> "%LOG%"
goto run_done
:run_bad
echo SIYO  prod inaendesha: mstari "Server sasa: 2.2.65" haumo - soma mstari wa "Server sasa" hapo juu >> "%LOG%"
set "BAD=1"
:run_done

findstr /c:"HAZIJAENDESHWA kwenye server (2)" "%LOG%" > nul
if errorlevel 1 goto pend_bad
echo SAWA  migrations zinazosubiri: [2] >> "%LOG%"
goto pend_done
:pend_bad
echo SIYO  migrations zinazosubiri: si 2 - soma orodha ya migrations hapo juu >> "%LOG%"
set "BAD=1"
:pend_done

findstr /c:"V128__Asset_Register_And_Asset_Counts.sql" "%LOG%" > nul
if errorlevel 1 goto v128_bad
echo SAWA  V128 iko kwenye orodha ya zinazosubiri >> "%LOG%"
goto v128_done
:v128_bad
echo SIYO  V128 haimo kwenye orodha ya zinazosubiri >> "%LOG%"
set "BAD=1"
:v128_done

findstr /c:"V129__Staff_Liability_Asset_Source.sql" "%LOG%" > nul
if errorlevel 1 goto v129_bad
echo SAWA  V129 iko kwenye orodha ya zinazosubiri >> "%LOG%"
goto v129_done
:v129_bad
echo SIYO  V129 haimo kwenye orodha ya zinazosubiri >> "%LOG%"
set "BAD=1"
:v129_done

findstr /c:"Flyway HAITAZIENDESHA" "%LOG%" > nul
if errorlevel 1 goto skip_ok
echo SIYO  kuna migrations ambazo Flyway haitaziendesha (ONYO hapo juu) >> "%LOG%"
set "BAD=1"
goto skip_done
:skip_ok
echo SAWA  hakuna migration iliyorukwa >> "%LOG%"
:skip_done

if "%BAD%"=="1" goto fail
echo PREFLIGHT_SAWA >> "%LOG%"
echo PREFLIGHT_SAWA. Matokeo: analysis\steps\11-prod-preflight.log
goto end
:fail
echo ---IMESHINDWA--- >> "%LOG%"
echo IMESHINDWA - soma analysis\steps\11-prod-preflight.log. Usiendelee na hatua ya 12.
:end
endlocal
