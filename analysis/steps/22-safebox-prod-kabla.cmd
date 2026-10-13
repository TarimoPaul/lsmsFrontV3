@echo off
rem HATUA 22 - PROD, KUSOMA TU. Hali ya production KABLA ya backend 2.2.70 (Sefu: kuwasilisha nusu + V132, mmiliki wa deposit + V133).
rem Haibadilishi chochote. SQL: safebox-kabla.sql (READ ONLY, inaishia ROLLBACK) - ileile ya hatua ya 16.
rem Lazima: backend ya prod ni 2.2.68, Flyway ya mwisho 131, FLYWAY_FAILED_MUST_BE_0 = 0, FLYWAY_132_MUST_BE_0 = 0,
rem         REMAINDER_REASON_COL_MUST_BE_0 = 0. Kimoja kikiwa tofauti, USIENDELEE na 23/24.
rem Endesha muda mfupi kabla ya 24: hesabu za Sefu (SAFE_BOX_...) zinalinganishwa na za hatua ya 25 baada ya deploy.
rem Matokeo: analysis\steps\22-safebox-prod-kabla.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---PROD-PS--- > analysis\steps\22-safebox-prod-kabla.log
ssh contabo "cd ~/lsms-deployment && docker compose ps -a && grep -E '^(BACKEND_VERSION|FRONTEND_V3_VERSION)=' .env" >> analysis\steps\22-safebox-prod-kabla.log 2>&1
echo ---PROD-LAST-SALE--- >> analysis\steps\22-safebox-prod-kabla.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select max(sale_date), count(*) from sales'" >> analysis\steps\22-safebox-prod-kabla.log 2>&1
echo ---PROD-KABLA-YA-V132--- >> analysis\steps\22-safebox-prod-kabla.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-kabla.sql >> analysis\steps\22-safebox-prod-kabla.log 2>&1
echo ---DUMP-ZA-MWISHO--- >> analysis\steps\22-safebox-prod-kabla.log
ssh contabo "ls -la ~/backups/daily | tail -4" >> analysis\steps\22-safebox-prod-kabla.log 2>&1
echo ---DISK-NA-RAM--- >> analysis\steps\22-safebox-prod-kabla.log
ssh contabo "df -h ~ | tail -1; free -m | head -2" >> analysis\steps\22-safebox-prod-kabla.log 2>&1
echo ---MWISHO--- >> analysis\steps\22-safebox-prod-kabla.log
echo Imekamilika. Matokeo: analysis\steps\22-safebox-prod-kabla.log
