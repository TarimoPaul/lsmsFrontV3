@echo off
rem HATUA 05 - KUSOMA TU. Inathibitisha staging baada ya 04, na kwamba prod haijabadilika.
rem Inasubiri backend ya staging iwake (hadi dakika 4), kisha: mistari ya Flyway na ERROR kwenye log, ps ya staging,
rem schema baada ya V127 (analysis\steps\thibitisha.sql, READ ONLY), ps ya prod, na Flyway ya prod (lazima ibaki 126).
rem Matokeo: analysis\steps\05-thibitisha.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-LOG-YA-BACKEND--- > analysis\steps\05-thibitisha.log
ssh contabo "cd ~/lsms-staging && for i in $(seq 1 48); do docker compose -p lsms-staging logs backend 2>&1 | grep -q -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed' && break; sleep 5; done; docker compose -p lsms-staging logs backend 2>&1 | grep -E 'Current version of schema|Migrating schema|Successfully applied|No migration necessary|Started LsmsApplication|APPLICATION FAILED|Application run failed|ERROR' | tail -40" >> analysis\steps\05-thibitisha.log 2>&1
echo ---STAGING-IDADI-YA-ERROR--- >> analysis\steps\05-thibitisha.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging logs backend 2>&1 | grep -c ' ERROR '" >> analysis\steps\05-thibitisha.log 2>&1
echo ---STAGING-PS--- >> analysis\steps\05-thibitisha.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging ps -a && grep BACKEND_VERSION .env" >> analysis\steps\05-thibitisha.log 2>&1
echo ---STAGING-SCHEMA-BAADA-YA-V127--- >> analysis\steps\05-thibitisha.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\thibitisha.sql >> analysis\steps\05-thibitisha.log 2>&1
echo ---PROD-PS--- >> analysis\steps\05-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose ps" >> analysis\steps\05-thibitisha.log 2>&1
echo ---PROD-FLYWAY-LAST-3--- >> analysis\steps\05-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version, success, installed_on from flyway_schema_history order by installed_rank desc limit 3'" >> analysis\steps\05-thibitisha.log 2>&1
echo ---MWISHO--- >> analysis\steps\05-thibitisha.log
echo Imekamilika. Matokeo: analysis\steps\05-thibitisha.log
