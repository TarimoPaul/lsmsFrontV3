@echo off
rem HATUA 07 - KWENYE PC HII + DOCKER HUB. Contabo HAIGUSWI (wala staging wala prod).
rem Inajenga 2.2.66 kutoka MAIN TU (D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms). HAIFANYI git commit wala merge:
rem endesha BAADA ya wewe mwenyewe kucommit Toleo A na kumerge feature/asset-counting kwenye main.
rem Inakagua kwanza (na kusimama kama si hivyo): branch ni main, .backend-version ni 2.2.65, V128 na V129 zipo,
rem code ya mali ipo. Kisha deploy\deploy-backend.ps1 -BuildOnly : working tree safi, mvn package + tests ZOTE
rem (orodha ya excludes sasa ni tupu), docker build, docker push ya chiefmaster/my-lsms-backend:2.2.66.
rem Script hiyo haiwasiliani na server na haibadilishi .backend-version.
rem Kumbuka: tag 2.2.66 ikishasukumwa haiandikwi upya. Docker Desktop iwe imewashwa na uwe umeingia Docker Hub.
rem Log iwe na BUILD_OK 2.2.66. Matokeo: analysis\steps\07-build-2266.log
set "LOG=D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\07-build-2266.log"
cd /d "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms"
if errorlevel 1 goto fail
echo ---BRANCH-COMMIT-NA-HALI--- > "%LOG%"
git rev-parse --abbrev-ref HEAD >> "%LOG%" 2>&1
git log -3 --oneline >> "%LOG%" 2>&1
git status --short >> "%LOG%" 2>&1
type .backend-version >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo ---LAZIMA-IWE-MAIN--- >> "%LOG%"
git rev-parse --abbrev-ref HEAD | findstr /x "main" >> "%LOG%" 2>&1
if errorlevel 1 goto fail
echo ---BACKEND-VERSION-LAZIMA-IWE-2.2.65--- >> "%LOG%"
findstr /x "2.2.65" .backend-version >> "%LOG%" 2>&1
if errorlevel 1 goto fail
echo ---TOLEO-A-LAZIMA-LIWE-NDANI-YA-MAIN--- >> "%LOG%"
if not exist "src\main\resources\db\migration\V128__Asset_Register_And_Asset_Counts.sql" goto nomerge
if not exist "src\main\resources\db\migration\V129__Staff_Liability_Asset_Source.sql" goto nomerge
if not exist "src\main\java\com\Lsms\Counting\Asset\AssetCountService.java" goto nomerge
dir /b src\main\resources\db\migration\V12*.sql >> "%LOG%" 2>&1
echo ---BUILD-ONLY-2.2.66--- >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-backend.ps1 -BuildOnly >> "%LOG%" 2>&1
if errorlevel 1 goto fail
echo ---MWISHO--- >> "%LOG%"
echo Imekamilika. Matokeo: analysis\steps\07-build-2266.log (tafuta BUILD_OK 2.2.66)
goto end
:nomerge
echo TOLEO A HALIMO KWENYE MAIN - merge feature/asset-counting kwenye main kwanza >> "%LOG%"
:fail
echo ---IMESHINDWA--- >> "%LOG%"
echo IMESHINDWA - soma analysis\steps\07-build-2266.log. Usiendelee na hatua ya 08.
:end
