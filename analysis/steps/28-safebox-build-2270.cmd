@echo off
rem HATUA 28 - KWENYE PC HII + DOCKER HUB. Contabo HAIGUSWI (wala staging wala prod).
rem Inajenga backend 2.2.70 kutoka MAIN TU (D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms). HAIFANYI git commit wala merge:
rem endesha BAADA ya wewe mwenyewe kusoma analysis\steps\safebox-owner-backend.diff na kucommit kwenye main.
rem 2.2.70 = 2.2.69 + mmiliki wa deposit ya Sefu:
rem   - user wa kawaida anawasilisha kwa entries zake tu;
rem   - ruhusa mpya SAFEBOX_DEPOSIT_ON_BEHALF (role CEO; ROOT anayo kwa wildcard) inaruhusu kuwasilisha kwa niaba;
rem   - aliyewasilisha hawezi kujithibitishia wala kujikabidhi (isipokuwa mwenye ruhusa hiyo);
rem   - V133: safu mpya safe_box_deposits.owner_uid (inajazwa kutoka recon ya deposit) + ruhusa hiyo.
rem Inakagua kwanza (na kusimama kama si hivyo): branch ni main, .backend-version ni 2.2.68, kizuizi na V133 vimo kwenye main.
rem Kisha deploy\deploy-backend.ps1 -BuildOnly : working tree safi, mvn package + tests zote, docker build, docker push.
rem Toleo linajihesabu: 2.2.69 tayari iko Docker Hub, kwa hiyo script itaruka hadi 2.2.70.
rem Log iwe na BUILD_OK 2.2.70. Ikionyesha namba nyingine, SIMAMA - hatua ya 29 inatumia 2.2.70.
rem Push ikishindwa kwa mtandao kama ile ya 2.2.69: docker push chiefmaster/my-lsms-backend:2.2.70 kwa mkono, kisha niambie.
rem Matokeo: analysis\steps\28-safebox-build-2270.log
setlocal
set "LOG=D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3\analysis\steps\28-safebox-build-2270.log"
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
echo ---MMILIKI-NA-V133-LAZIMA-VIWE-NDANI-YA-MAIN--- >> "%LOG%"
git grep -n "SAFEBOX_DEPOSIT_ON_BEHALF" HEAD -- src/main/java/com/Lsms/Reconciliation >> "%LOG%" 2>&1
git grep -q "mayActOnBehalf" HEAD -- src/main/java/com/Lsms/Reconciliation/Services/SafeBoxService.java
if errorlevel 1 goto nocommit
git grep -q "maySelfConfirm" HEAD -- src/main/java/com/Lsms/Reconciliation/Services/SafeBoxService.java
if errorlevel 1 goto nocommit
git cat-file -e HEAD:src/main/resources/db/migration/V133__Safe_Box_Deposit_Owner_And_On_Behalf.sql
if errorlevel 1 goto nocommit
git ls-tree --name-only HEAD src/main/resources/db/migration/ | findstr /r "V13[0-9]__" >> "%LOG%" 2>&1
echo ---BUILD-ONLY-2.2.70--- >> "%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -File deploy\deploy-backend.ps1 -BuildOnly >> "%LOG%" 2>&1
if errorlevel 1 goto fail
echo ---MWISHO--- >> "%LOG%"
echo Imekamilika. Matokeo: analysis\steps\28-safebox-build-2270.log (tafuta BUILD_OK 2.2.70)
goto end
:nocommit
echo MMILIKI WA DEPOSIT / V133 HAVIMO KWENYE MAIN - soma safebox-owner-backend.diff kisha commit kwanza >> "%LOG%"
:fail
echo ---IMESHINDWA--- >> "%LOG%"
echo IMESHINDWA - soma analysis\steps\28-safebox-build-2270.log. Usiendelee na hatua ya 29.
:end
endlocal
