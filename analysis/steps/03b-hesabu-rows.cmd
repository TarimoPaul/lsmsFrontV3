@echo off
rem HATUA 03b - KUSOMA TU. Row counts za kila jedwali: staging (baada ya restore) na prod (ilivyo sasa).
rem SQL iko analysis\steps\rows.sql (transaction ya READ ONLY, inaishia ROLLBACK). Hakuna kinachoandikwa popote.
rem Prod imeendelea tangu 02:00, kwa hiyo jedwali chache za leo zitakuwa na rows zaidi prod - hilo linatarajiwa.
rem Matokeo: analysis\steps\03b-rows-staging.log na analysis\steps\03b-rows-prod.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\rows.sql > analysis\steps\03b-rows-staging.log 2>&1
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\rows.sql > analysis\steps\03b-rows-prod.log 2>&1
echo Imekamilika. Matokeo: analysis\steps\03b-rows-staging.log na analysis\steps\03b-rows-prod.log
