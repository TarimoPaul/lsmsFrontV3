@echo off
rem HATUA 13 - PROD, KUSOMA TU. Inathibitisha production baada ya hatua ya 12 (backend 2.2.66).
rem Mistari ya Flyway na ERROR kwenye log ya backend, ps ya prod, schema baada ya V128 + V129 (thibitisha-a.sql, READ ONLY),
rem na alama ya madeni yaliyopo ikilinganishwa na 10-alama-prod.log.
rem Lazima: FLYWAY_128_129_MUST_BE_2 = 2, NEW_CONSTRAINTS_MUST_BE_6 = 6, FOREIGN_KEYS_BAADA = FOREIGN_KEYS_KABLA (hatua 10) + 3.
rem ALAMA_TOFAUTI hapa inaweza kuwa halali: malipo au deni jipya la mfanyakazi lililoingia kati ya hatua ya 10 na 13.
rem Likitokea, linganisha mistari miwili ya ALAMA kwa macho (idadi na jumla) kabla ya kuhofia.
rem Matokeo: analysis\steps\13-prod-thibitisha.log na analysis\steps\13-alama-prod.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---PROD-LOG-YA-BACKEND--- > analysis\steps\13-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose logs backend 2>&1 | grep -E 'Current version of schema|Migrating schema|Successfully applied|No migration necessary|Started LsmsApplication|APPLICATION FAILED|Application run failed' | tail -20" >> analysis\steps\13-prod-thibitisha.log 2>&1
echo ---PROD-IDADI-YA-ERROR--- >> analysis\steps\13-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose logs backend 2>&1 | grep -c ' ERROR '" >> analysis\steps\13-prod-thibitisha.log 2>&1
echo ---PROD-ERROR-ZA-MWISHO--- >> analysis\steps\13-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose logs backend 2>&1 | grep ' ERROR ' | tail -10 | cut -c1-300" >> analysis\steps\13-prod-thibitisha.log 2>&1
echo ---PROD-PS--- >> analysis\steps\13-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose ps -a && grep -E '^(BACKEND_VERSION|FRONTEND_V3_VERSION)=' .env" >> analysis\steps\13-prod-thibitisha.log 2>&1
echo ---PROD-SCHEMA-BAADA-YA-V128-V129--- >> analysis\steps\13-prod-thibitisha.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\thibitisha-a.sql >> analysis\steps\13-prod-thibitisha.log 2>&1
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\alama-madeni.sql > analysis\steps\13-alama-prod.log 2>&1
echo ---ALAMA-YA-MADENI-KABLA-NA-BAADA--- >> analysis\steps\13-prod-thibitisha.log
type analysis\steps\10-alama-prod.log >> analysis\steps\13-prod-thibitisha.log 2>&1
type analysis\steps\13-alama-prod.log >> analysis\steps\13-prod-thibitisha.log 2>&1
fc analysis\steps\10-alama-prod.log analysis\steps\13-alama-prod.log > nul 2>&1
if errorlevel 1 goto alamatofauti
echo ALAMA_SAWA >> analysis\steps\13-prod-thibitisha.log
goto mwisho
:alamatofauti
echo ALAMA_TOFAUTI - linganisha mistari ya ALAMA hapo juu (malipo ya mchana yanaweza kuwa sababu), au 10-alama-prod.log halipo >> analysis\steps\13-prod-thibitisha.log
:mwisho
echo ---MWISHO--- >> analysis\steps\13-prod-thibitisha.log
echo Imekamilika. Matokeo: analysis\steps\13-prod-thibitisha.log
