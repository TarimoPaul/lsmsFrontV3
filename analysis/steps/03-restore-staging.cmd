@echo off
rem HATUA 03 - INABADILISHA STAGING TU: DB ya staging inafutwa na kurejeshwa kutoka dump ya leo (prod 2026-10-07 02:00).
rem Endesha baada ya 02 kuonyesha SHA_SAWA. Production (~/lsms-deployment) HAIGUSWI - inasomwa tu (ps kabla na baada).
rem Mpangilio: hakiki dump tena, prod ps, simamisha backend ya staging, hifadhi DB ya zamani ya staging,
rem            dropdb + createdb Lsms (container ya postgres ya STAGING), pg_restore, washa backend 2.2.63 tena.
rem Amri ikishindwa, faili linasimama hapo hapo. Matokeo: analysis\steps\03-restore-staging.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---HAKIKI-DUMP-TENA--- > analysis\steps\03-restore-staging.log
ssh contabo "cmp /tmp/staging-restore/lsms_20261007_0200.dump ~/backups/daily/lsms_20261007_0200.dump && echo SHA_SAWA" >> analysis\steps\03-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---PROD-PS-KABLA--- >> analysis\steps\03-restore-staging.log
ssh contabo "cd ~/lsms-deployment && docker compose ps" >> analysis\steps\03-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-SIMAMISHA-BACKEND--- >> analysis\steps\03-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging stop backend" >> analysis\steps\03-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-HIFADHI-DB-YA-ZAMANI--- >> analysis\steps\03-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_dump -U postgres -Fc Lsms > ~/lsms-staging/staging_kabla_ya_refresh_20261007.dump && ls -l ~/lsms-staging/staging_kabla_ya_refresh_20261007.dump" >> analysis\steps\03-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-DROPDB--- >> analysis\steps\03-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres dropdb -U postgres --if-exists --force Lsms && echo DROPDB_SAWA" >> analysis\steps\03-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-CREATEDB--- >> analysis\steps\03-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres createdb -U postgres Lsms && echo CREATEDB_SAWA" >> analysis\steps\03-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-PG-RESTORE--- >> analysis\steps\03-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_restore -U postgres -d Lsms --no-owner --exit-on-error < /tmp/staging-restore/lsms_20261007_0200.dump && echo PG_RESTORE_SAWA" >> analysis\steps\03-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-WASHA-BACKEND-2.2.63--- >> analysis\steps\03-restore-staging.log
ssh contabo "cd ~/lsms-staging && grep BACKEND_VERSION .env && docker compose -p lsms-staging up -d backend" >> analysis\steps\03-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-SUBIRI-BACKEND-IWAKE--- >> analysis\steps\03-restore-staging.log
ssh contabo "cd ~/lsms-staging && for i in $(seq 1 40); do docker compose -p lsms-staging logs --since 5m backend 2>&1 | grep -q 'Started LsmsApplication' && break; sleep 5; done; docker compose -p lsms-staging logs --since 5m backend 2>&1 | grep -E 'Migrating schema|Successfully applied|No migration necessary|Started LsmsApplication|ERROR' | tail -20" >> analysis\steps\03-restore-staging.log 2>&1
echo ---STAGING-PS--- >> analysis\steps\03-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging ps -a" >> analysis\steps\03-restore-staging.log 2>&1
echo ---PROD-PS-BAADA--- >> analysis\steps\03-restore-staging.log
ssh contabo "cd ~/lsms-deployment && docker compose ps" >> analysis\steps\03-restore-staging.log 2>&1
echo ---MWISHO--- >> analysis\steps\03-restore-staging.log
echo Imekamilika. Matokeo: analysis\steps\03-restore-staging.log
goto end
:fail
echo ---IMESHINDWA--- >> analysis\steps\03-restore-staging.log
echo IMESHINDWA - soma analysis\steps\03-restore-staging.log. Hatua zilizofuata HAZIKUENDESHWA.
:end
