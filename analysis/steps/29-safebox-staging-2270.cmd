@echo off
rem HATUA 29 - INABADILISHA STAGING TU: backend ya staging 2.2.69 -> 2.2.70 (mmiliki wa deposit ya Sefu + kwa niaba).
rem Endesha baada ya 28 kuonyesha BUILD_OK 2.2.70 na mimi kuthibitisha digest ya Docker Hub.
rem Flyway itaendesha migration MOJA: V133__Safe_Box_Deposit_Owner_And_On_Behalf.sql
rem (safu mpya safe_box_deposits.owner_uid inayojazwa kutoka recon ya kila deposit, ruhusa SAFEBOX_DEPOSIT_ON_BEHALF,
rem  na kuipa role CEO. Hakuna thamani iliyopo inayobadilishwa.)
rem Kinga: faili linasimama kama staging si 2.2.69 au migration ya mwisho si 132.
rem Kinachobadilika: dump ya DB ya staging (nakala ya kurudi nyuma), nakala ya .env, mstari wa BACKEND_VERSION,
rem container ya backend ya staging. Production (~/lsms-deployment) HAIGUSWI - inasomwa tu mwishoni.
rem Kisha inasubiri backend iwake (hadi dakika 4) na kuendesha safebox-thibitisha-133.sql (READ ONLY).
rem Lazima: Started LsmsApplication, idadi ya ERROR 0, FLYWAY_133_MUST_BE_1 = 1, OWNER_UID_COL_MUST_BE_1 = 1,
rem         OWNER_UID_NULL_MUST_BE_0 = 0, OWNER_UID_SI_MMILIKI_WA_RECON_MUST_BE_0 = 0, RUHUSA_MUST_BE_1 = 1,
rem         RUHUSA_KWA_ROLE inaonyesha CEO.
rem Matokeo: analysis\steps\29-safebox-staging-2270.log   Baada ya hapo endesha tena hatua ya 27 (b na c).
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-TOLEO-LA-SASA-LAZIMA-2.2.69--- > analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && grep -Fx 'BACKEND_VERSION=2.2.69' .env" >> analysis\steps\29-safebox-staging-2270.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-FLYWAY-YA-MWISHO-LAZIMA-IWE-132--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version from flyway_schema_history order by installed_rank desc limit 1' | grep -x 132" >> analysis\steps\29-safebox-staging-2270.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-HIFADHI-DB-KABLA-YA-MIGRATION--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_dump -U postgres -Fc Lsms > ~/lsms-staging/staging_kabla_ya_2270_20261013.dump && ls -l ~/lsms-staging/staging_kabla_ya_2270_20261013.dump" >> analysis\steps\29-safebox-staging-2270.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-NAKALA-YA-ENV--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && cp -p .env .env.bak.20261013-kabla-ya-2270 && ls -l .env .env.bak.20261013-kabla-ya-2270" >> analysis\steps\29-safebox-staging-2270.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-BADILISHA-BACKEND_VERSION--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && sed -i 's/^BACKEND_VERSION=.*/BACKEND_VERSION=2.2.70/' .env && grep BACKEND_VERSION .env && diff .env.bak.20261013-kabla-ya-2270 .env | grep -c BACKEND_VERSION" >> analysis\steps\29-safebox-staging-2270.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-PULL-IMAGE--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging pull -q backend && docker image inspect chiefmaster/my-lsms-backend:2.2.70 --format '{{index .RepoDigests 0}}'" >> analysis\steps\29-safebox-staging-2270.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-WASHA-BACKEND-2.2.70--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging up -d backend" >> analysis\steps\29-safebox-staging-2270.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-LOG-YA-BACKEND--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && for i in $(seq 1 48); do docker compose -p lsms-staging logs backend 2>&1 | grep -q -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed' && break; sleep 5; done; docker compose -p lsms-staging logs backend 2>&1 | grep -E 'Current version of schema|Migrating schema|Successfully applied|No migration necessary|Started LsmsApplication|APPLICATION FAILED|Application run failed|ERROR' | tail -40" >> analysis\steps\29-safebox-staging-2270.log 2>&1
echo ---STAGING-IDADI-YA-ERROR--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging logs backend 2>&1 | grep -c ' ERROR '" >> analysis\steps\29-safebox-staging-2270.log 2>&1
echo ---STAGING-BAADA-YA-V133--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-thibitisha-133.sql >> analysis\steps\29-safebox-staging-2270.log 2>&1
echo ---STAGING-PS--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging ps -a && grep BACKEND_VERSION .env" >> analysis\steps\29-safebox-staging-2270.log 2>&1
echo ---PROD-PS--- >> analysis\steps\29-safebox-staging-2270.log
ssh contabo "cd ~/lsms-deployment && docker compose ps && grep BACKEND_VERSION .env" >> analysis\steps\29-safebox-staging-2270.log 2>&1
echo ---MWISHO--- >> analysis\steps\29-safebox-staging-2270.log
echo Imekamilika. Matokeo: analysis\steps\29-safebox-staging-2270.log
goto end
:fail
echo ---IMESHINDWA--- >> analysis\steps\29-safebox-staging-2270.log
echo IMESHINDWA - soma analysis\steps\29-safebox-staging-2270.log. Hatua zilizofuata HAZIKUENDESHWA.
:end
