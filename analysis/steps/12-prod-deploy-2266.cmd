@echo off
rem HATUA 12 - INABADILISHA PRODUCTION: backend 2.2.65 -> 2.2.66 kwa script ya kawaida ya deploy.
rem   deploy\deploy-backend.ps1 -DeployOnly 2.2.66   (HAKUNA build wala push: image ileile iliyojaribiwa staging)
rem Script inafanya: preflight + swali (andika ndio), dump ya DB iliyothibitishwa, BACKEND_VERSION=2.2.66, compose up backend,
rem health check, na rollback ya image yenyewe ikishindwa. Flyway itaendesha V128 na V129.
rem Kumbuka: /api inakuwa chini ~65s. Migration ikishaendeshwa hairudi yenyewe (rollback inarudisha image tu, si database).
rem Baada ya DEPLOY_OK script inaandika .backend-version = 2.2.66 na kufanya commit yake kwenye main ya backend (git push ni yako).
rem Inakataa kuanza kama hatua ya 11 haikuishia PREFLIGHT_SAWA. Matokeo yanaonekana kwenye dirisha hili (hakuna log:
rem swali la script linahitaji dirisha), kwa hiyo usilifunge kabla ya kuona DEPLOY_OK 2.2.66.
findstr /c:"PREFLIGHT_SAWA" "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\11-prod-preflight.log" > nul
if errorlevel 1 goto nopreflight
cd /d "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms"
if errorlevel 1 goto end
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-backend.ps1 -DeployOnly 2.2.66
echo.
echo Mwisho wa hatua ya 12. Kama umeona DEPLOY_OK 2.2.66, endesha hatua ya 13 (kusoma tu).
goto end
:nopreflight
echo IMEKATALIWA - analysis\steps\11-prod-preflight.log haina PREFLIGHT_SAWA. Endesha hatua ya 11 kwanza.
:end
pause
