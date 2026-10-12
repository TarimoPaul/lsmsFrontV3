@echo off
rem HATUA 16 - KUSOMA TU. Hali ya staging na prod KABLA ya backend 2.2.69 (Sefu: kuwasilisha nusu + V132).
rem Haibadilishi chochote kwenye Contabo. SQL: safebox-kabla.sql (READ ONLY, inaishia ROLLBACK), staging kisha prod.
rem V132__Safe_Box_Deposit_Remainder_Reason.sql = safu MOJA mpya safe_box_deposits.remainder_reason (TEXT, inaruhusu NULL).
rem Haibadilishi wala kufuta data iliyopo, haina index wala constraint mpya.
rem Lazima (staging NA prod): FLYWAY_FAILED_MUST_BE_0 = 0, FLYWAY_132_MUST_BE_0 = 0, REMAINDER_REASON_COL_MUST_BE_0 = 0.
rem FLYWAY_ALL ya prod italinganishwa na orodha ya faili za migration za main (sehemu ya mwisho ya log):
rem kinachosubiri kinatakiwa kiwe V132 PEKEE. Kimoja kikiwa tofauti, USIENDELEE na 17/18.
rem Matokeo: analysis\steps\16-safebox-kabla.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-PS--- > analysis\steps\16-safebox-kabla.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging ps -a && grep BACKEND_VERSION .env" >> analysis\steps\16-safebox-kabla.log 2>&1
echo ---STAGING-LAST-SALE--- >> analysis\steps\16-safebox-kabla.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select max(sale_date), count(*) from sales'" >> analysis\steps\16-safebox-kabla.log 2>&1
echo ---STAGING-KABLA-YA-V132--- >> analysis\steps\16-safebox-kabla.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-kabla.sql >> analysis\steps\16-safebox-kabla.log 2>&1
echo ---PROD-PS--- >> analysis\steps\16-safebox-kabla.log
ssh contabo "cd ~/lsms-deployment && docker compose ps && grep BACKEND_VERSION .env" >> analysis\steps\16-safebox-kabla.log 2>&1
echo ---PROD-KABLA-YA-V132--- >> analysis\steps\16-safebox-kabla.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-kabla.sql >> analysis\steps\16-safebox-kabla.log 2>&1
echo ---DISK-NA-RAM--- >> analysis\steps\16-safebox-kabla.log
ssh contabo "df -h ~ | tail -1; free -m | head -2" >> analysis\steps\16-safebox-kabla.log 2>&1
echo ---MIGRATIONS-ZA-MAIN-KWENYE-PC--- >> analysis\steps\16-safebox-kabla.log
git -C "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms" rev-parse --abbrev-ref HEAD >> analysis\steps\16-safebox-kabla.log 2>&1
git -C "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms" status --short >> analysis\steps\16-safebox-kabla.log 2>&1
dir /b "D:\MY PROJECT\DUKA PROJECT\Lsms\Lsms\src\main\resources\db\migration" >> analysis\steps\16-safebox-kabla.log 2>&1
echo ---MWISHO--- >> analysis\steps\16-safebox-kabla.log
echo Imekamilika. Matokeo: analysis\steps\16-safebox-kabla.log
