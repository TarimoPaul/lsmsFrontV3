@echo off
rem HATUA 14 - INABADILISHA PRODUCTION (/v3/ tu): V3 3.1.6 -> 3.1.7 kutoka main ya lsmsFrontV3 (9f97ddc, skrini "Mali za duka").
rem Endesha BAADA ya hatua ya 13 kuwa safi: kichupo "Mali za duka" kinahitaji backend 2.2.66.
rem   deploy\deploy-v3.ps1   = bump patch, docker build, docker push, deploy, health check, rollback yenyewe ikishindwa.
rem Flutter (/) na backend (/api) haviguswi. Script inakataa working tree isiyo safi (analysis\ peke yake inaruhusiwa)
rem na inauliza swali la preflight. Baada ya DEPLOY_OK inaandika .frontend-v3-version = 3.1.7 na kufanya commit yake.
rem Inakagua kwanza: branch ni main na toleo la sasa ni 3.1.6. Matokeo yanaonekana kwenye dirisha hili.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
if errorlevel 1 goto end
set "BRANCH="
for /f "usebackq delims=" %%B in (`git rev-parse --abbrev-ref HEAD`) do set "BRANCH=%%B"
if /i not "%BRANCH%"=="main" goto badbranch
echo SAWA  branch: [%BRANCH%]
set "VER="
set /p VER=<.frontend-v3-version
if not "%VER%"=="3.1.6" goto badver
echo SAWA  .frontend-v3-version: [%VER%]
git log -1 --oneline
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-v3.ps1
echo.
echo Mwisho wa hatua ya 14. Tafuta DEPLOY_OK 3.1.7 hapo juu.
goto end
:badbranch
echo SIYO  branch: imeonekana [%BRANCH%], inatakiwa [main]. Hakuna kilichofanywa.
goto end
:badver
echo SIYO  .frontend-v3-version: imeonekana [%VER%], inatakiwa [3.1.6]. Hakuna kilichofanywa.
:end
endlocal
pause
