@echo off
rem HATUA 09 - KUSOMA TU. Inathibitisha staging baada ya 08, na kwamba prod haijabadilika.
rem Inasubiri backend ya staging iwake (hadi dakika 4), kisha: mistari ya Flyway na ERROR kwenye log, ps ya staging,
rem schema baada ya V128 + V129 (thibitisha-a.sql, READ ONLY), alama ya madeni yaliyopo (lazima ilingane na 06-alama.log),
rem ps ya prod na Flyway ya prod (haipaswi kuwa na 128 wala 129).
rem Matokeo: analysis\steps\09-thibitisha-a.log na analysis\steps\09-alama.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-LOG-YA-BACKEND--- > analysis\steps\09-thibitisha-a.log
ssh contabo "cd ~/lsms-staging && for i in $(seq 1 48); do docker compose -p lsms-staging logs backend 2>&1 | grep -q -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed' && break; sleep 5; done; docker compose -p lsms-staging logs backend 2>&1 | grep -E 'Current version of schema|Migrating schema|Successfully applied|No migration necessary|Started LsmsApplication|APPLICATION FAILED|Application run failed|ERROR' | tail -40" >> analysis\steps\09-thibitisha-a.log 2>&1
echo ---STAGING-IDADI-YA-ERROR--- >> analysis\steps\09-thibitisha-a.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging logs backend 2>&1 | grep -c ' ERROR '" >> analysis\steps\09-thibitisha-a.log 2>&1
echo ---STAGING-PS--- >> analysis\steps\09-thibitisha-a.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging ps -a && grep BACKEND_VERSION .env" >> analysis\steps\09-thibitisha-a.log 2>&1
echo ---STAGING-SCHEMA-BAADA-YA-V128-V129--- >> analysis\steps\09-thibitisha-a.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\thibitisha-a.sql >> analysis\steps\09-thibitisha-a.log 2>&1
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\alama-madeni.sql > analysis\steps\09-alama.log 2>&1
echo ---ALAMA-YA-MADENI-KABLA-NA-BAADA--- >> analysis\steps\09-thibitisha-a.log
type analysis\steps\06-alama.log >> analysis\steps\09-thibitisha-a.log 2>&1
type analysis\steps\09-alama.log >> analysis\steps\09-thibitisha-a.log 2>&1
fc analysis\steps\06-alama.log analysis\steps\09-alama.log > nul 2>&1
if errorlevel 1 goto alamatofauti
echo ALAMA_SAWA >> analysis\steps\09-thibitisha-a.log
goto prod
:alamatofauti
echo ALAMA_TOFAUTI - madeni yaliyopo yamebadilika, au faili la 06-alama.log halipo >> analysis\steps\09-thibitisha-a.log
:prod
echo ---PROD-PS--- >> analysis\steps\09-thibitisha-a.log
ssh contabo "cd ~/lsms-deployment && docker compose ps" >> analysis\steps\09-thibitisha-a.log 2>&1
echo ---PROD-FLYWAY-LAST-3--- >> analysis\steps\09-thibitisha-a.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version, success, installed_on from flyway_schema_history order by installed_rank desc limit 3'" >> analysis\steps\09-thibitisha-a.log 2>&1
echo ---MWISHO--- >> analysis\steps\09-thibitisha-a.log
echo Imekamilika. Matokeo: analysis\steps\09-thibitisha-a.log
