@echo off
rem HATUA 24 - INABADILISHA PRODUCTION: backend 2.2.68 -> 2.2.70 kwa script ya kawaida ya deploy.
rem   deploy\deploy-backend.ps1 -DeployOnly 2.2.70   (HAKUNA build wala push: image ileile iliyojaribiwa staging)
rem Script inafanya: preflight + swali (andika ndio), dump ya DB iliyothibitishwa, BACKEND_VERSION=2.2.70, compose up backend,
rem health check, na rollback ya image yenyewe ikishindwa. Flyway itaendesha V132 na V133 TU:
rem   V132 = safu mpya safe_box_deposits.remainder_reason (TEXT, inaruhusu NULL);
rem   V133 = safu mpya safe_box_deposits.owner_uid (inajazwa kutoka recon ya kila deposit) + ruhusa SAFEBOX_DEPOSIT_ON_BEHALF kwa role CEO.
rem Hakuna thamani iliyopo inayobadilishwa wala kufutwa.
rem Kumbuka: /api inakuwa chini ~65s. Migration ikishaendeshwa hairudi yenyewe (rollback inarudisha image tu, si database).
rem Baada ya DEPLOY_OK script inaandika .backend-version = 2.2.70 na kufanya commit yake kwenye main ya backend (git push ni yako).
rem Inakataa kuanza kama hatua ya 23 haikuishia PREFLIGHT_SAWA. Matokeo yanaonekana kwenye dirisha hili (hakuna log:
rem swali la script linahitaji dirisha), kwa hiyo usilifunge kabla ya kuona DEPLOY_OK 2.2.70.
findstr /c:"PREFLIGHT_SAWA" "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\23-safebox-prod-preflight.log" > nul
if errorlevel 1 goto nopreflight
cd /d "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms"
if errorlevel 1 goto end
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-backend.ps1 -DeployOnly 2.2.70
echo.
echo Mwisho wa hatua ya 24. Kama umeona DEPLOY_OK 2.2.70, endesha hatua ya 25 (kusoma tu).
goto end
:nopreflight
echo IMEKATALIWA - analysis\steps\23-safebox-prod-preflight.log haina PREFLIGHT_SAWA. Endesha hatua ya 23 kwanza.
:end
pause
