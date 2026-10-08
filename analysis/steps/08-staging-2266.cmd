@echo off
rem HATUA 08 - INABADILISHA STAGING TU: backend ya staging 2.2.65 -> 2.2.66.
rem Endesha baada ya 06 kuwa safi na 07 kuonyesha BUILD_OK 2.2.66.
rem Flyway itaendesha migration MBILI: V128__Asset_Register_And_Asset_Counts.sql (jedwali 4 mpya + permissions 2)
rem na V129__Staff_Liability_Asset_Source.sql (safu 3 mpya zenye FK, NOT NULL 3 zinalegezwa, CHECK 2, UNIQUE 1).
rem Kinachobadilika: dump ya DB ya staging (nakala ya kurudi nyuma), nakala ya .env, mstari wa BACKEND_VERSION,
rem container ya backend ya staging. Production (~/lsms-deployment) HAIGUSWI. Amri ikishindwa, faili linasimama.
rem Matokeo: analysis\steps\08-staging-2266.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-LAZIMA-IWE-2.2.65--- > analysis\steps\08-staging-2266.log
ssh contabo "cd ~/lsms-staging && grep -x 'BACKEND_VERSION=2.2.65' .env" >> analysis\steps\08-staging-2266.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-HIFADHI-DB-KABLA-YA-MIGRATION--- >> analysis\steps\08-staging-2266.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_dump -U postgres -Fc Lsms > ~/lsms-staging/staging_kabla_ya_2266_20261008.dump && ls -l ~/lsms-staging/staging_kabla_ya_2266_20261008.dump" >> analysis\steps\08-staging-2266.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-NAKALA-YA-ENV--- >> analysis\steps\08-staging-2266.log
ssh contabo "cd ~/lsms-staging && cp -p .env .env.bak.20261008-kabla-ya-2266 && ls -l .env .env.bak.20261008-kabla-ya-2266" >> analysis\steps\08-staging-2266.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-BADILISHA-BACKEND_VERSION--- >> analysis\steps\08-staging-2266.log
ssh contabo "cd ~/lsms-staging && sed -i 's/^BACKEND_VERSION=.*/BACKEND_VERSION=2.2.66/' .env && grep BACKEND_VERSION .env && diff .env.bak.20261008-kabla-ya-2266 .env | grep -c BACKEND_VERSION" >> analysis\steps\08-staging-2266.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-PULL-IMAGE--- >> analysis\steps\08-staging-2266.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging pull -q backend && docker image inspect chiefmaster/my-lsms-backend:2.2.66 --format '{{index .RepoDigests 0}}'" >> analysis\steps\08-staging-2266.log 2>&1
if errorlevel 1 goto fail
echo ---STAGING-WASHA-BACKEND-2.2.66--- >> analysis\steps\08-staging-2266.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging up -d backend" >> analysis\steps\08-staging-2266.log 2>&1
if errorlevel 1 goto fail
echo ---MWISHO--- >> analysis\steps\08-staging-2266.log
echo Imekamilika. Sasa endesha hatua ya 09 (kusoma tu). Matokeo: analysis\steps\08-staging-2266.log
goto end
:fail
echo ---IMESHINDWA--- >> analysis\steps\08-staging-2266.log
echo IMESHINDWA - soma analysis\steps\08-staging-2266.log. Hatua zilizofuata HAZIKUENDESHWA.
:end
