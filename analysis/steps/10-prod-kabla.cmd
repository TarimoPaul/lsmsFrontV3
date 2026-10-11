@echo off
rem HATUA 10 - PROD, KUSOMA TU. Hali ya production KABLA ya backend 2.2.66 (V128 mali + V129 madeni ya mali).
rem Haibadilishi chochote. SQL ni zilezile za staging: kabla-a.sql na alama-madeni.sql (READ ONLY, zinaishia ROLLBACK).
rem Lazima: backend ya prod ni 2.2.65, Flyway ya mwisho 127, FLYWAY_FAILED_MUST_BE_0 = 0, SL_SESSION_NULL_MUST_BE_0 = 0,
rem         SLI_STOCK_NULL_MUST_BE_0 = 0, ASSET_TABLES_MUST_BE_0 = 0, ASSET_COLUMNS_MUST_BE_0 = 0.
rem Kimoja kikiwa tofauti, USIENDELEE. Endesha muda mfupi kabla ya 12 (alama ya madeni inalinganishwa baada ya deploy).
rem Matokeo: analysis\steps\10-prod-kabla.log na analysis\steps\10-alama-prod.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---PROD-PS--- > analysis\steps\10-prod-kabla.log
ssh contabo "cd ~/lsms-deployment && docker compose ps -a && grep -E '^(BACKEND_VERSION|FRONTEND_V3_VERSION)=' .env" >> analysis\steps\10-prod-kabla.log 2>&1
echo ---PROD-LAST-SALE--- >> analysis\steps\10-prod-kabla.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select max(sale_date), count(*) from sales'" >> analysis\steps\10-prod-kabla.log 2>&1
echo ---PROD-KABLA-YA-2.2.66--- >> analysis\steps\10-prod-kabla.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\kabla-a.sql >> analysis\steps\10-prod-kabla.log 2>&1
echo ---DUMP-ZA-MWISHO--- >> analysis\steps\10-prod-kabla.log
ssh contabo "ls -la ~/backups/daily | tail -4" >> analysis\steps\10-prod-kabla.log 2>&1
echo ---DISK-NA-RAM--- >> analysis\steps\10-prod-kabla.log
ssh contabo "df -h ~ | tail -1; free -m | head -2" >> analysis\steps\10-prod-kabla.log 2>&1
echo ---MWISHO--- >> analysis\steps\10-prod-kabla.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\alama-madeni.sql > analysis\steps\10-alama-prod.log 2>&1
echo Imekamilika. Matokeo: analysis\steps\10-prod-kabla.log na analysis\steps\10-alama-prod.log
