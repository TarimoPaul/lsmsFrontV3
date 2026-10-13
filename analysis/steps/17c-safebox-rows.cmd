@echo off
rem HATUA 17c - KUSOMA TU. Baada ya 17b: row counts za kila jedwali, staging (baada ya restore) na prod (ilivyo sasa),
rem na hali ya Sefu + Flyway ya staging kabla ya V132.
rem SQL: analysis\steps\rows.sql na analysis\steps\safebox-kabla.sql (zote READ ONLY, zinaishia ROLLBACK).
rem Prod imeendelea tangu 02:00, kwa hiyo jedwali chache za leo zitakuwa na rows zaidi prod - hilo linatarajiwa.
rem Lazima (staging): FLYWAY_ALL inaishia 130 131, FLYWAY_FAILED_MUST_BE_0 = 0, FLYWAY_132_MUST_BE_0 = 0,
rem                   REMAINDER_REASON_COL_MUST_BE_0 = 0.
rem Matokeo: analysis\steps\17c-rows-staging.log, analysis\steps\17c-rows-prod.log, analysis\steps\17c-safebox-rows.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\rows.sql > analysis\steps\17c-rows-staging.log 2>&1
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\rows.sql > analysis\steps\17c-rows-prod.log 2>&1
echo ---STAGING-SEFU-NA-FLYWAY-BAADA-YA-RESTORE--- > analysis\steps\17c-safebox-rows.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-kabla.sql >> analysis\steps\17c-safebox-rows.log 2>&1
echo ---STAGING-PS--- >> analysis\steps\17c-safebox-rows.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging ps -a && grep BACKEND_VERSION .env" >> analysis\steps\17c-safebox-rows.log 2>&1
echo ---PROD-PS--- >> analysis\steps\17c-safebox-rows.log
ssh contabo "cd ~/lsms-deployment && docker compose ps && grep BACKEND_VERSION .env" >> analysis\steps\17c-safebox-rows.log 2>&1
echo ---MWISHO--- >> analysis\steps\17c-safebox-rows.log
echo Imekamilika. Matokeo: analysis\steps\17c-rows-staging.log, 17c-rows-prod.log, 17c-safebox-rows.log
