@echo off
rem HATUA 57a - BUILD YA 2.2.72 (hotfix) KUTOKA WORKTREE YA HOTFIX (mmiliki 26/10). Inajenga, inaendesha unit tests, inasukuma
rem   image chiefmaster/my-lsms-backend:2.2.72 - NA INASIMAMA (-BuildOnly). Server haiguswi; .backend-version haibadilishwi.
rem Lazima kwanza: mmiliki ame-commit hotfix kwenye branch hotfix/2.2.72 (worktree D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms-hotfix-2272)
rem   baada ya kusoma analysis\steps\hotfix-2272-backend.diff. Docker Desktop iwe inawaka.
rem Kinga (kabla ya build): branch = hotfix/2.2.72; .backend-version = 2.2.71; hotfix iko kwenye HEAD (GlClosedPeriodException,
rem   DataInitializerRootUserTest); HEAD haina V135 wala migration yoyote ambayo main haina; application.properties (gitignored)
rem   ina mstari mmoja tu root.password=${ROOT_PASSWORD:} na hakuna root.password nyingine. deploy-backend.ps1 yenyewe inakagua
rem   tena: working tree safi, Assert-ReleaseBranch (main au hotfix/* tu, hakuna migration isiyo kwenye main), JDK 21, tag mpya.
rem Matokeo: analysis\steps\57a-hotfix-2272-build.log (lazima [OK] BUILD_OK 2.2.72 na ---MWISHO---).
setlocal
set "LOG=D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\57a-hotfix-2272-build.log"
cd /d "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms-hotfix-2272"
if errorlevel 1 goto fail
echo ---BRANCH-COMMIT-NA-HALI--- > "%LOG%"
git rev-parse --abbrev-ref HEAD >> "%LOG%" 2>&1
git log -3 --oneline >> "%LOG%" 2>&1
git status --short >> "%LOG%" 2>&1
echo ---LAZIMA-IWE-HOTFIX-2.2.72--- >> "%LOG%"
set "BRANCH="
for /f "usebackq delims=" %%B in (`git rev-parse --abbrev-ref HEAD`) do set "BRANCH=%%B"
echo branch: [%BRANCH%] >> "%LOG%"
if not "%BRANCH%"=="hotfix/2.2.72" goto fail
echo ---BACKEND-VERSION-LAZIMA-IWE-2.2.71--- >> "%LOG%"
set "VER="
set /p VER=<.backend-version
echo .backend-version: [%VER%] >> "%LOG%"
if not "%VER%"=="2.2.71" goto fail
echo ---HOTFIX-LAZIMA-IWE-KWENYE-HEAD--- >> "%LOG%"
git cat-file -e HEAD:src/main/java/com/Lsms/CapitalAndExpenditure/gl/GlClosedPeriodException.java
if errorlevel 1 goto nocommit
git cat-file -e HEAD:src/test/java/com/Lsms/uaa/entity/DataInitializerRootUserTest.java
if errorlevel 1 goto nocommit
git grep -q "Assert-ReleaseBranch" HEAD -- deploy/deploy-backend.ps1
if errorlevel 1 goto nocommit
echo ---HAKUNA-MIGRATION-MPYA (V135 iko feature/sales-returns tu)--- >> "%LOG%"
git ls-tree --name-only HEAD src/main/resources/db/migration/ | findstr /r "V13[0-9]__" >> "%LOG%" 2>&1
git cat-file -e HEAD:src/main/resources/db/migration/V135__Sales_Return_Refund_Method_And_Exchange.sql 2> nul
if not errorlevel 1 (
  echo SIYO: V135 iko kwenye HEAD ya hotfix - hotfix haiongezi migration >> "%LOG%"
  goto fail
)
echo ---ROOT-PASSWORD-KWENYE-APPLICATION-PROPERTIES--- >> "%LOG%"
set "RP="
for /f "usebackq delims=" %%r in (`powershell -NoProfile -Command "$l = @(Get-Content -LiteralPath 'src\main\resources\application.properties' | Where-Object { $_ -match '^\s*root\.password\s*[=:]' }); if ($l.Count -eq 1 -and $l[0].Trim() -ceq 'root.password=${ROOT_PASSWORD:}') { 'ROOT_PASSWORD_PROPERTY_SAWA' } else { 'SIYO mistari ' + $l.Count }"`) do set "RP=%%r"
echo %RP% >> "%LOG%"
if not "%RP%"=="ROOT_PASSWORD_PROPERTY_SAWA" goto fail
echo ---BUILD-ONLY-2.2.72--- >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-backend.ps1 -BuildOnly >> "%LOG%" 2>&1
if errorlevel 1 goto fail
findstr /b /l /c:"[OK] BUILD_OK 2.2.72 " "%LOG%" > nul
if errorlevel 1 (
  echo SIYO: build haikutoa BUILD_OK 2.2.72 - huenda tag 2.2.72 tayari ipo Docker Hub; soma juu, usiendelee >> "%LOG%"
  goto fail
)
echo ---MWISHO--- >> "%LOG%"
echo Imekamilika. Matokeo: analysis\steps\57a-hotfix-2272-build.log ([OK] BUILD_OK 2.2.72). Sasa unaweza kuendesha 57b.
goto end
:nocommit
echo HOTFIX HAIMO KWENYE HEAD YA hotfix/2.2.72 - soma hotfix-2272-backend.diff kisha commit kwanza >> "%LOG%"
:fail
echo ---IMESHINDWA--- >> "%LOG%"
echo IMESHINDWA - soma analysis\steps\57a-hotfix-2272-build.log. Usiendelee na 57b.
:end
endlocal
