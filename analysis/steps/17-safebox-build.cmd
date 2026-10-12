@echo off
rem HATUA 17 - KWENYE PC HII + DOCKER HUB. Contabo HAIGUSWI (wala staging wala prod).
rem Inajenga backend 2.2.69 kutoka MAIN TU (D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms). HAIFANYI git commit wala merge:
rem endesha BAADA ya wewe mwenyewe kusoma analysis\steps\safebox-backend.diff na kucommit mabadiliko ya Sefu kwenye main.
rem Inakagua kwanza (na kusimama kama si hivyo): branch ni main, .backend-version ni 2.2.68, V132 ipo,
rem endpoint ya my-outstanding ipo kwenye SafeBoxController.
rem Kisha deploy\deploy-backend.ps1 -BuildOnly : working tree safi, mvn package + tests zote, docker build,
rem docker push ya chiefmaster/my-lsms-backend:2.2.69. Script hiyo haiwasiliani na server na haibadilishi .backend-version.
rem Kumbuka: tag ikishasukumwa haiandikwi upya. Docker Desktop iwe imewashwa na uwe umeingia Docker Hub.
rem Log iwe na BUILD_OK 2.2.69. Ikionyesha namba nyingine (tag 2.2.69 tayari ipo Docker Hub), SIMAMA - hatua ya 18 inatumia 2.2.69.
rem Matokeo: analysis\steps\17-safebox-build.log
setlocal
set "LOG=D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\17-safebox-build.log"
cd /d "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms"
if errorlevel 1 goto fail
echo ---BRANCH-COMMIT-NA-HALI--- > "%LOG%"
git rev-parse --abbrev-ref HEAD >> "%LOG%" 2>&1
git log -3 --oneline >> "%LOG%" 2>&1
git status --short >> "%LOG%" 2>&1
echo ---LAZIMA-IWE-MAIN--- >> "%LOG%"
set "BRANCH="
for /f "usebackq delims=" %%B in (`git rev-parse --abbrev-ref HEAD`) do set "BRANCH=%%B"
echo branch: [%BRANCH%] >> "%LOG%"
if /i not "%BRANCH%"=="main" goto fail
echo ---BACKEND-VERSION-LAZIMA-IWE-2.2.68--- >> "%LOG%"
set "VER="
set /p VER=<.backend-version
echo .backend-version: [%VER%] >> "%LOG%"
if not "%VER%"=="2.2.68" goto fail
echo ---SEFU-LAZIMA-IWE-NDANI-YA-MAIN--- >> "%LOG%"
if not exist "src\main\resources\db\migration\V132__Safe_Box_Deposit_Remainder_Reason.sql" goto nocommit
findstr /c:"my-outstanding" "src\main\java\com\Lsms\Reconciliation\Controller\SafeBoxController.java" >> "%LOG%" 2>&1
if errorlevel 1 goto nocommit
dir /b src\main\resources\db\migration\V13*.sql >> "%LOG%" 2>&1
echo ---BUILD-ONLY-2.2.69--- >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-backend.ps1 -BuildOnly >> "%LOG%" 2>&1
if errorlevel 1 goto fail
echo ---MWISHO--- >> "%LOG%"
echo Imekamilika. Matokeo: analysis\steps\17-safebox-build.log (tafuta BUILD_OK 2.2.69)
goto end
:nocommit
echo MABADILIKO YA SEFU HAYAMO KWENYE MAIN - soma safebox-backend.diff kisha commit kwanza >> "%LOG%"
:fail
echo ---IMESHINDWA--- >> "%LOG%"
echo IMESHINDWA - soma analysis\steps\17-safebox-build.log. Usiendelee na hatua ya 18.
:end
endlocal
