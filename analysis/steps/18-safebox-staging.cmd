@echo off
rem HATUA 18 - INABADILISHA STAGING TU: backend ya staging -> 2.2.69.
rem Endesha baada ya 16 kuwa safi na 17 kuonyesha BUILD_OK 2.2.69.
rem Flyway itaendesha migration MOJA: V132__Safe_Box_Deposit_Remainder_Reason.sql
rem (safu moja mpya safe_box_deposits.remainder_reason, TEXT, inaruhusu NULL; data iliyopo haiguswi).
rem Kama log ya 16 ilionyesha staging iko nyuma ya prod (migrations nyingine zinasubiri), USIENDESHE - niambie kwanza.
rem Kinachobadilika: dump ya DB ya staging (nakala ya kurudi nyuma), nakala ya .env, mstari wa BACKEND_VERSION,
rem container ya backend ya staging. Production (~/lsms-deployment) HAIGUSWI. Amri ikishindwa, faili linasimama.
rem Matokeo: analysis\steps\18-safebox-staging.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-TOLEO-LA-SASA--- > analysis\steps\18-safebox-staging.log
ssh contabo "cd ~/lsms-staging && grep BACKEND_VERSION .env" >> analysis\steps\18-safebox-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-HIFADHI-DB-KABLA-YA-MIGRATION--- >> analysis\steps\18-safebox-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_dump -U postgres -Fc Lsms > ~/lsms-staging/staging_kabla_ya_2269_20261012.dump && ls -l ~/lsms-staging/staging_kabla_ya_2269_20261012.dump" >> analysis\steps\18-safebox-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-NAKALA-YA-ENV--- >> analysis\steps\18-safebox-staging.log
ssh contabo "cd ~/lsms-staging && cp -p .env .env.bak.20261012-kabla-ya-2269 && ls -l .env .env.bak.20261012-kabla-ya-2269" >> analysis\steps\18-safebox-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-BADILISHA-BACKEND_VERSION--- >> analysis\steps\18-safebox-staging.log
ssh contabo "cd ~/lsms-staging && sed -i 's/^BACKEND_VERSION=.*/BACKEND_VERSION=2.2.69/' .env && grep BACKEND_VERSION .env && diff .env.bak.20261012-kabla-ya-2269 .env | grep -c BACKEND_VERSION" >> analysis\steps\18-safebox-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-PULL-IMAGE--- >> analysis\steps\18-safebox-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging pull -q backend && docker image inspect chiefmaster/my-lsms-backend:2.2.69 --format '{{index .RepoDigests 0}}'" >> analysis\steps\18-safebox-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-WASHA-BACKEND-2.2.69--- >> analysis\steps\18-safebox-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging up -d backend" >> analysis\steps\18-safebox-staging.log 2>&1
if errorlevel 1 goto fail
echo ---MWISHO--- >> analysis\steps\18-safebox-staging.log
echo Imekamilika. Sasa endesha hatua ya 19 (kusoma tu). Matokeo: analysis\steps\18-safebox-staging.log
goto end
:fail
echo ---IMESHINDWA--- >> analysis\steps\18-safebox-staging.log
echo IMESHINDWA - soma analysis\steps\18-safebox-staging.log. Hatua zilizofuata HAZIKUENDESHWA.
:end
