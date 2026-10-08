@echo off
rem HATUA 04 - INABADILISHA STAGING TU: backend ya staging 2.2.63 -> 2.2.65.
rem Flyway itaendesha migration MOJA: V127__Order_Suggestion_User_Added_Lines.sql (safu mpya kwenye jedwali 2 za oda).
rem Kinachobadilika: nakala ya .env, mstari wa BACKEND_VERSION kwenye ~/lsms-staging/.env, container ya backend ya staging.
rem Production (~/lsms-deployment) HAIGUSWI. Amri ikishindwa, faili linasimama. Matokeo: analysis\steps\04-staging-2265.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-NAKALA-YA-ENV--- > analysis\steps\04-staging-2265.log
ssh contabo "cd ~/lsms-staging && cp -p .env .env.bak.20261007-kabla-ya-2265 && ls -l .env .env.bak.20261007-kabla-ya-2265" >> analysis\steps\04-staging-2265.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-BADILISHA-BACKEND_VERSION--- >> analysis\steps\04-staging-2265.log
ssh contabo "cd ~/lsms-staging && sed -i 's/^BACKEND_VERSION=.*/BACKEND_VERSION=2.2.65/' .env && grep BACKEND_VERSION .env && diff .env.bak.20261007-kabla-ya-2265 .env | grep -c BACKEND_VERSION" >> analysis\steps\04-staging-2265.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-PULL-IMAGE--- >> analysis\steps\04-staging-2265.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging pull -q backend && docker image inspect chiefmaster/my-lsms-backend:2.2.65 --format '{{index .RepoDigests 0}}'" >> analysis\steps\04-staging-2265.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-WASHA-BACKEND-2.2.65--- >> analysis\steps\04-staging-2265.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging up -d backend" >> analysis\steps\04-staging-2265.log 2>&1
if errorlevel 1 goto fail
echo ---MWISHO--- >> analysis\steps\04-staging-2265.log
echo Imekamilika. Sasa endesha hatua ya 05 (kusoma tu). Matokeo: analysis\steps\04-staging-2265.log
goto end
:fail
echo ---IMESHINDWA--- >> analysis\steps\04-staging-2265.log
echo IMESHINDWA - soma analysis\steps\04-staging-2265.log. Hatua zilizofuata HAZIKUENDESHWA.
:end
