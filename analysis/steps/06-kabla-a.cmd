@echo off
rem HATUA 06 - KUSOMA TU. Hali ya staging KABLA ya Toleo A (backend 2.2.66 = V128 mali + V129 madeni ya mali).
rem Haibadilishi chochote kwenye Contabo. SQL: kabla-a.sql na alama-madeni.sql (zote READ ONLY, zinaishia ROLLBACK).
rem Lazima: BACKEND_VERSION=2.2.65, Flyway ya mwisho 127, SL_SESSION_NULL_MUST_BE_0 = 0, SLI_STOCK_NULL_MUST_BE_0 = 0,
rem         ASSET_TABLES_MUST_BE_0 = 0. Kimoja kikiwa tofauti, USIENDELEE na 07/08.
rem Matokeo: analysis\steps\06-kabla-a.log na analysis\steps\06-alama.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-PS--- > analysis\steps\06-kabla-a.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging ps -a && grep BACKEND_VERSION .env" >> analysis\steps\06-kabla-a.log 2>&1
echo ---STAGING-LAST-SALE--- >> analysis\steps\06-kabla-a.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select max(sale_date), count(*) from sales'" >> analysis\steps\06-kabla-a.log 2>&1
echo ---STAGING-KABLA-YA-TOLEO-A--- >> analysis\steps\06-kabla-a.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\kabla-a.sql >> analysis\steps\06-kabla-a.log 2>&1
echo ---DISK-NA-RAM--- >> analysis\steps\06-kabla-a.log
ssh contabo "df -h ~ | tail -1; free -m | head -2" >> analysis\steps\06-kabla-a.log 2>&1
echo ---MWISHO--- >> analysis\steps\06-kabla-a.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\alama-madeni.sql > analysis\steps\06-alama.log 2>&1
echo Imekamilika. Matokeo: analysis\steps\06-kabla-a.log na analysis\steps\06-alama.log
