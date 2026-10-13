@echo off
rem HATUA 17b - INABADILISHA STAGING TU: DB ya staging inafutwa na kurejeshwa kutoka dump ya leo (prod 2026-10-13 02:00).
rem Endesha baada ya 17a kuonyesha SHA_SAWA. Production (~/lsms-deployment) HAIGUSWI - inasomwa tu (ps kabla na baada).
rem Mpangilio: hakiki dump tena, prod ps, simamisha backend ya staging, hifadhi DB ya zamani ya staging,
rem            dropdb + createdb Lsms (container ya postgres ya STAGING), pg_restore.
rem Backend ya staging INABAKI IMESIMAMA: 2.2.66 haijui V130/V131 zilizomo kwenye dump, kwa hiyo haiwashwi tena.
rem Hatua ya 18 ndiyo itakayoiwasha moja kwa moja kwa 2.2.69. Mpaka hapo tunnel ya staging (8081) haitajibu /api.
rem Amri ikishindwa, faili linasimama hapo hapo. Matokeo: analysis\steps\17b-safebox-restore-staging.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---HAKIKI-DUMP-TENA--- > analysis\steps\17b-safebox-restore-staging.log
ssh contabo "cmp /tmp/staging-restore/lsms_20261013_0200.dump ~/backups/daily/lsms_20261013_0200.dump && echo SHA_SAWA" >> analysis\steps\17b-safebox-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---PROD-PS-KABLA--- >> analysis\steps\17b-safebox-restore-staging.log
ssh contabo "cd ~/lsms-deployment && docker compose ps" >> analysis\steps\17b-safebox-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-SIMAMISHA-BACKEND--- >> analysis\steps\17b-safebox-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging stop backend" >> analysis\steps\17b-safebox-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-HIFADHI-DB-YA-ZAMANI--- >> analysis\steps\17b-safebox-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_dump -U postgres -Fc Lsms > ~/lsms-staging/staging_kabla_ya_refresh_20261013.dump && ls -l ~/lsms-staging/staging_kabla_ya_refresh_20261013.dump" >> analysis\steps\17b-safebox-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-DROPDB--- >> analysis\steps\17b-safebox-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres dropdb -U postgres --if-exists --force Lsms && echo DROPDB_SAWA" >> analysis\steps\17b-safebox-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-CREATEDB--- >> analysis\steps\17b-safebox-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres createdb -U postgres Lsms && echo CREATEDB_SAWA" >> analysis\steps\17b-safebox-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-PG-RESTORE--- >> analysis\steps\17b-safebox-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_restore -U postgres -d Lsms --no-owner --exit-on-error < /tmp/staging-restore/lsms_20261013_0200.dump && echo PG_RESTORE_SAWA" >> analysis\steps\17b-safebox-restore-staging.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-FLYWAY-YA-MWISHO-LAZIMA-IWE-131--- >> analysis\steps\17b-safebox-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version from flyway_schema_history order by installed_rank desc limit 1'" >> analysis\steps\17b-safebox-restore-staging.log 2>&1
echo ---STAGING-PS-backend-iwe-Exited--- >> analysis\steps\17b-safebox-restore-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging ps -a && grep BACKEND_VERSION .env" >> analysis\steps\17b-safebox-restore-staging.log 2>&1
echo ---PROD-PS-BAADA--- >> analysis\steps\17b-safebox-restore-staging.log
ssh contabo "cd ~/lsms-deployment && docker compose ps" >> analysis\steps\17b-safebox-restore-staging.log 2>&1
echo ---MWISHO--- >> analysis\steps\17b-safebox-restore-staging.log
echo Imekamilika. Sasa endesha 17c (kusoma tu). Matokeo: analysis\steps\17b-safebox-restore-staging.log
goto end
:fail
echo ---IMESHINDWA--- >> analysis\steps\17b-safebox-restore-staging.log
echo IMESHINDWA - soma analysis\steps\17b-safebox-restore-staging.log. Hatua zilizofuata HAZIKUENDESHWA.
:end
