@echo off
rem HATUA 25 - PROD, KUSOMA TU. Inathibitisha production baada ya hatua ya 24 (backend 2.2.70).
rem Mistari ya Flyway na ERROR kwenye log ya backend, ps ya prod, schema baada ya V132 + V133 na query ya "bado unadaiwa"
rem (safebox-thibitisha.sql, READ ONLY, ileile ya hatua ya 19).
rem Lazima: Started LsmsApplication, FLYWAY_FAILED_MUST_BE_0 = 0, FLYWAY_132_MUST_BE_1 = 1,
rem         REMAINDER_REASON_COL_MUST_BE_1 = 1, PENDING_OVER_REMAINING_MUST_BE_0 = 0.
rem SAFE_BOX_DEPOSITS_BY_STATUS na SAFE_BOX_ENTRIES zilinganishwe na 22-safebox-prod-kabla.log: tofauti inaweza kuwa halali
rem (deposit au entry ya Sefu iliyoingia kati ya hatua ya 22 na 25). REMAINDER_REASON_FILLED inaweza kuwa zaidi ya 0
rem kama cashier amekwisha wasilisha nusu na sababu baada ya deploy.
rem V133 (safebox-thibitisha-133.sql, READ ONLY): FLYWAY_133_MUST_BE_1 = 1, OWNER_UID_COL_MUST_BE_1 = 1, OWNER_UID_NULL_MUST_BE_0 = 0,
rem         OWNER_UID_SI_MMILIKI_WA_RECON_MUST_BE_0 = 0, RUHUSA_MUST_BE_1 = 1, RUHUSA_KWA_ROLE inaonyesha CEO, KWA_NIABA = zile 9 za hatua 30.
rem Matokeo: analysis\steps\25-safebox-prod-thibitisha.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---PROD-LOG-YA-BACKEND--- > analysis\steps\25-safebox-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose logs backend 2>&1 | grep -E 'Current version of schema|Migrating schema|Successfully applied|No migration necessary|Started LsmsApplication|APPLICATION FAILED|Application run failed' | tail -20" >> analysis\steps\25-safebox-prod-thibitisha.log 2>&1
echo ---PROD-IDADI-YA-ERROR--- >> analysis\steps\25-safebox-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose logs backend 2>&1 | grep -c ' ERROR '" >> analysis\steps\25-safebox-prod-thibitisha.log 2>&1
echo ---PROD-ERROR-ZA-MWISHO--- >> analysis\steps\25-safebox-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose logs backend 2>&1 | grep ' ERROR ' | tail -10 | cut -c1-300" >> analysis\steps\25-safebox-prod-thibitisha.log 2>&1
echo ---PROD-PS--- >> analysis\steps\25-safebox-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose ps -a && grep -E '^(BACKEND_VERSION|FRONTEND_V3_VERSION)=' .env" >> analysis\steps\25-safebox-prod-thibitisha.log 2>&1
echo ---PROD-BAADA-YA-V132--- >> analysis\steps\25-safebox-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-thibitisha.sql >> analysis\steps\25-safebox-prod-thibitisha.log 2>&1
echo ---PROD-BAADA-YA-V133--- >> analysis\steps\25-safebox-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-thibitisha-133.sql >> analysis\steps\25-safebox-prod-thibitisha.log 2>&1
echo ---MWISHO--- >> analysis\steps\25-safebox-prod-thibitisha.log
echo Imekamilika. Matokeo: analysis\steps\25-safebox-prod-thibitisha.log
