@echo off
rem HATUA 19 - KUSOMA TU. Inathibitisha staging baada ya 18, na kwamba prod haijabadilika.
rem Inasubiri backend ya staging iwake (hadi dakika 4), kisha: mistari ya Flyway na ERROR kwenye log, ps ya staging,
rem schema baada ya V132 na query mpya ya "bado unadaiwa" ikiendeshwa kwenye DB halisi (safebox-thibitisha.sql, READ ONLY),
rem ps ya prod na Flyway ya prod (haipaswi kuwa na 132).
rem Lazima: Started LsmsApplication, FLYWAY_FAILED_MUST_BE_0 = 0, FLYWAY_132_MUST_BE_1 = 1,
rem         REMAINDER_REASON_COL_MUST_BE_1 = 1, REMAINDER_REASON_FILLED_MUST_BE_0 = 0, PENDING_OVER_REMAINING_MUST_BE_0 = 0,
rem         SAFE_BOX_DEPOSITS_BY_STATUS na SAFE_BOX_ENTRIES sawa na zile za 17c-safebox-rows.log (staging baada ya restore), na Flyway imeendesha 132 PEKE YAKE.
rem Matokeo: analysis\steps\19-safebox-thibitisha.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-LOG-YA-BACKEND--- > analysis\steps\19-safebox-thibitisha.log
ssh contabo "cd ~/lsms-staging && for i in $(seq 1 48); do docker compose -p lsms-staging logs backend 2>&1 | grep -q -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed' && break; sleep 5; done; docker compose -p lsms-staging logs backend 2>&1 | grep -E 'Current version of schema|Migrating schema|Successfully applied|No migration necessary|Started LsmsApplication|APPLICATION FAILED|Application run failed|ERROR' | tail -40" >> analysis\steps\19-safebox-thibitisha.log 2>&1
echo ---STAGING-IDADI-YA-ERROR--- >> analysis\steps\19-safebox-thibitisha.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging logs backend 2>&1 | grep -c ' ERROR '" >> analysis\steps\19-safebox-thibitisha.log 2>&1
echo ---STAGING-PS--- >> analysis\steps\19-safebox-thibitisha.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging ps -a && grep BACKEND_VERSION .env" >> analysis\steps\19-safebox-thibitisha.log 2>&1
echo ---STAGING-BAADA-YA-V132--- >> analysis\steps\19-safebox-thibitisha.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-thibitisha.sql >> analysis\steps\19-safebox-thibitisha.log 2>&1
echo ---PROD-PS--- >> analysis\steps\19-safebox-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose ps && grep BACKEND_VERSION .env" >> analysis\steps\19-safebox-thibitisha.log 2>&1
echo ---PROD-FLYWAY-LAST-3--- >> analysis\steps\19-safebox-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version, success, installed_on from flyway_schema_history order by installed_rank desc limit 3'" >> analysis\steps\19-safebox-thibitisha.log 2>&1
echo ---MWISHO--- >> analysis\steps\19-safebox-thibitisha.log
echo Imekamilika. Matokeo: analysis\steps\19-safebox-thibitisha.log
