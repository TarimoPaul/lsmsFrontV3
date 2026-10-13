@echo off
rem HATUA 26 - INABADILISHA PRODUCTION (/v3/ tu): V3 3.1.9 -> 3.1.10 kutoka main ya lsmsFrontV3 (b896c47, Sefu: bango + wasilisha nusu).
rem Endesha BAADA ya hatua ya 25 kuwa safi: bango la "bado unadaiwa" linahitaji backend 2.2.70 (/safe-box/my-outstanding).
rem   deploy\deploy-v3.ps1   = bump patch, docker build, docker push, deploy, health check, rollback yenyewe ikishindwa.
rem Flutter (/) na backend (/api) haviguswi. Script inakataa working tree isiyo safi (analysis\ peke yake inaruhusiwa)
rem na inauliza swali la preflight. Baada ya DEPLOY_OK inaandika .frontend-v3-version = 3.1.10 na kufanya commit yake.
rem Inakagua kwanza: branch ni main na toleo la sasa ni 3.1.9. Matokeo yanaonekana kwenye dirisha hili.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
if errorlevel 1 goto end
set "BRANCH="
for /f "usebackq delims=" %%B in (`git rev-parse --abbrev-ref HEAD`) do set "BRANCH=%%B"
if /i not "%BRANCH%"=="main" goto badbranch
echo SAWA  branch: [%BRANCH%]
set "VER="
set /p VER=<.frontend-v3-version
if not "%VER%"=="3.1.9" goto badver
echo SAWA  .frontend-v3-version: [%VER%]
git log -1 --oneline
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-v3.ps1
echo.
echo Mwisho wa hatua ya 26. Tafuta DEPLOY_OK 3.1.10 hapo juu.
goto end
:badbranch
echo SIYO  branch: imeonekana [%BRANCH%], inatakiwa [main]. Hakuna kilichofanywa.
goto end
:badver
echo SIYO  .frontend-v3-version: imeonekana [%VER%], inatakiwa [3.1.9]. Hakuna kilichofanywa.
:end
endlocal
pause
