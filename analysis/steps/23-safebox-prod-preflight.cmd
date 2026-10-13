@echo off
rem HATUA 23 - PREFLIGHT YA PROD, KUSOMA TU: deploy\deploy-backend.ps1 -DeployOnly 2.2.70 -PreflightOnly
rem Inavuta image 2.2.70 kwenye PC hii, inasoma migrations ndani ya jar yake, inasoma hali ya prod (--status) na kusimama.
rem Hakuna deploy, hakuna swali. Kitu pekee kinachoandikwa kwenye Contabo ni nakala ya script /tmp/deploy-backend.sh.
rem Kisha inakagua log (kila sharti SAWA au SIYO):
rem   - digest ya image ni ile iliyojaribiwa staging (BADO haijawekwa: 2.2.70 haijajengwa; mpaka hapo faili hili linaishia IMESHINDWA)
rem   - migrations zinazosubiri ni MBILI tu, V132 na V133
rem   - prod sasa inaendesha 2.2.68
rem Mstari wa mwisho uwe PREFLIGHT_SAWA; vinginevyo hatua ya 24 itakataa. Matokeo: analysis\steps\23-safebox-prod-preflight.log
setlocal
set "LOG=D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\23-safebox-prod-preflight.log"
set "DIGEST=BADO-digest-ya-2.2.70-itawekwa-baada-ya-hatua-28-na-29"
set "BAD=0"
cd /d "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms"
if errorlevel 1 goto fail
echo ---PREFLIGHT-ONLY-2.2.70--- > "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-backend.ps1 -DeployOnly 2.2.70 -PreflightOnly >> "%LOG%" 2>&1
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

findstr /c:"Server sasa: 2.2.68" "%LOG%" > nul
if errorlevel 1 goto run_bad
echo SAWA  prod inaendesha: [2.2.68] >> "%LOG%"
goto run_done
:run_bad
echo SIYO  prod inaendesha: mstari "Server sasa: 2.2.68" haumo - soma mstari wa "Server sasa" hapo juu >> "%LOG%"
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

findstr /c:"V132__Safe_Box_Deposit_Remainder_Reason.sql" "%LOG%" > nul
if errorlevel 1 goto v132_bad
echo SAWA  V132 iko kwenye orodha ya zinazosubiri >> "%LOG%"
goto v132_done
:v132_bad
echo SIYO  V132 haimo kwenye orodha ya zinazosubiri >> "%LOG%"
set "BAD=1"
:v132_done

findstr /c:"V133__Safe_Box_Deposit_Owner_And_On_Behalf.sql" "%LOG%" > nul
if errorlevel 1 goto v133_bad
echo SAWA  V133 iko kwenye orodha ya zinazosubiri >> "%LOG%"
goto v133_done
:v133_bad
echo SIYO  V133 haimo kwenye orodha ya zinazosubiri >> "%LOG%"
set "BAD=1"
:v133_done

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
echo PREFLIGHT_SAWA. Matokeo: analysis\steps\23-safebox-prod-preflight.log
goto end
:fail
echo ---IMESHINDWA--- >> "%LOG%"
echo IMESHINDWA - soma analysis\steps\23-safebox-prod-preflight.log. Usiendelee na hatua ya 24.
:end
endlocal
