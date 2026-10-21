@echo off
rem HATUA 37 - KWENYE PC HII + DOCKER HUB. Contabo HAIGUSWI (wala staging wala prod).
rem Inajenga backend 2.2.71 (Toleo 1) kutoka MAIN TU (D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms). HAIFANYI git commit wala merge:
rem endesha BAADA ya wewe mwenyewe kusoma analysis\steps\toleo1-backend.diff na kucommit kwenye main.
rem 2.2.71 = 2.2.70 + Toleo 1 (MPANGO-PAMOJA):
rem   - H-2: sale inapostiwa BAADA ya commit kutoka DB (si entity ya async); kosa lolote la GL linabaki gl_posting_failure;
rem   - H-1: variance chanya = upungufu (Dr 6700 / Cr 1000); ziada isizidi pesa iliyohesabiwa; declared 0 = hakuna posting;
rem   - H-5: reopen/supersede inageuza journal ya variance ya snapshot ya zamani;
rem   - vipindi: mwezi uliofungwa -> tukio linaandikwa siku ya kwanza iliyo wazi (event_date + alama); journal ya mkono inakataliwa;
rem   - V134: gl_posting_failure, daily_financial_snapshot.variance_kind, journal_entry.event_date/is_late_entry,
rem           gl_period.closed_by_uid/checks_json, gl_period_audit.
rem Inakagua kwanza (na kusimama kama si hivyo): branch ni main, .backend-version ni 2.2.70, V134 na code ya Toleo 1 vimo kwenye main.
rem Kisha deploy\deploy-backend.ps1 -BuildOnly : working tree safi, mvn package + tests zote, docker build, docker push.
rem Log iwe na BUILD_OK 2.2.71. Ikionyesha namba nyingine, SIMAMA - hatua ya 38c inatumia 2.2.71.
rem Matokeo: analysis\steps\37-toleo1-build-2271.log
setlocal
set "LOG=D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\37-toleo1-build-2271.log"
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
echo ---BACKEND-VERSION-LAZIMA-IWE-2.2.70--- >> "%LOG%"
set "VER="
set /p VER=<.backend-version
echo .backend-version: [%VER%] >> "%LOG%"
if not "%VER%"=="2.2.70" goto fail
echo ---TOLEO-1-NA-V134-LAZIMA-VIWE-NDANI-YA-MAIN--- >> "%LOG%"
git cat-file -e HEAD:src/main/resources/db/migration/V134__Gl_Posting_Failure_And_Period_Close.sql
if errorlevel 1 goto nocommit
git cat-file -e HEAD:src/main/java/com/Lsms/CapitalAndExpenditure/gl/GlPostingFailureService.java
if errorlevel 1 goto nocommit
git cat-file -e HEAD:src/main/java/com/Lsms/CapitalAndExpenditure/gl/SaleGlPostingService.java
if errorlevel 1 goto nocommit
git grep -q "classifyDayCloseVariance" HEAD -- src/main/java/com/Lsms/CapitalAndExpenditure/gl/PostingEngine.java
if errorlevel 1 goto nocommit
git grep -q "saleGlPostingService.postAfterCommit" HEAD -- src/main/java/com/Lsms/Sales/Services/SaleService.java
if errorlevel 1 goto nocommit
git grep -n "dayCloseVarianceService" HEAD -- src/main/java/com/Lsms/Reconciliation/Services/ReconciliationService.java >> "%LOG%" 2>&1
git ls-tree --name-only HEAD src/main/resources/db/migration/ | findstr /r "V13[0-9]__" >> "%LOG%" 2>&1
echo ---BUILD-ONLY-2.2.71--- >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-backend.ps1 -BuildOnly >> "%LOG%" 2>&1
if errorlevel 1 goto fail
echo ---MWISHO--- >> "%LOG%"
echo Imekamilika. Matokeo: analysis\steps\37-toleo1-build-2271.log (tafuta BUILD_OK 2.2.71)
goto end
:nocommit
echo TOLEO 1 / V134 HAVIMO KWENYE MAIN - soma toleo1-backend.diff kisha commit kwanza >> "%LOG%"
:fail
echo ---IMESHINDWA--- >> "%LOG%"
echo IMESHINDWA - soma analysis\steps\37-toleo1-build-2271.log. Usiendelee na hatua ya 38.
:end
endlocal
