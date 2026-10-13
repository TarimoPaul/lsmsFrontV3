@echo off
rem HATUA 17a - KUPAKUA DUMP YA LEO YA PROD KUTOKA B2 + SHA256. Haigusi database yoyote wala container yoyote.
rem Kwa nini: log ya 16 inaonyesha staging iko 2.2.66 / Flyway 129 / data ya 2026-10-06, prod iko 2.2.68 / Flyway 131.
rem Bila kurejesha DB, 2.2.69 ingeendesha V130 + V131 + V132 kwenye staging - si kama itakavyokuwa prod (V132 peke yake).
rem Kinachobadilika: faili moja la muda kwenye Contabo, /tmp/staging-restore/lsms_20261013_0200.dump
rem Dump ni ya 2026-10-13 02:00. Ukiendesha siku nyingine, niambie nibadilishe tarehe kwenye 17a na 17b.
rem Kwanza inasoma prod (KUSOMA TU): lazima iwe bado 2.2.68 / Flyway 131. Ikiwa tofauti, faili linasimama kabla ya kupakua.
rem Matokeo: analysis\steps\17a-safebox-pakua-dump.log   (mstari wa mwisho uwe SHA_SAWA)
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---PROD-PS-LAZIMA-IWE-2.2.68--- > analysis\steps\17a-safebox-pakua-dump.log
ssh contabo "cd ~/lsms-deployment && docker compose ps && grep -Fx 'BACKEND_VERSION=2.2.68' .env && docker compose ps backend | grep -F 'my-lsms-backend:2.2.68' > /dev/null && echo PROD_2268_SAWA" >> analysis\steps\17a-safebox-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---PROD-FLYWAY-YA-MWISHO-LAZIMA-IWE-131--- >> analysis\steps\17a-safebox-pakua-dump.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version, success, installed_on from flyway_schema_history order by installed_rank desc limit 3' && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version from flyway_schema_history order by installed_rank desc limit 1' | grep -qx 131 && echo PROD_FLYWAY_131_SAWA" >> analysis\steps\17a-safebox-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---DUMP-ZA-MWISHO-B2-NA-CONTABO--- >> analysis\steps\17a-safebox-pakua-dump.log
ssh contabo "rclone lsf b2:elikom-lsms-backups/daily/ | sort | tail -3; ls -l ~/backups/daily/ | tail -3" >> analysis\steps\17a-safebox-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---PAKUA-KUTOKA-B2--- >> analysis\steps\17a-safebox-pakua-dump.log
ssh contabo "mkdir -p /tmp/staging-restore && rclone copyto b2:elikom-lsms-backups/daily/lsms_20261013_0200.dump /tmp/staging-restore/lsms_20261013_0200.dump && ls -l /tmp/staging-restore" >> analysis\steps\17a-safebox-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---SHA256-B2-NA-NAKALA-YA-CONTABO--- >> analysis\steps\17a-safebox-pakua-dump.log
ssh contabo "sha256sum /tmp/staging-restore/lsms_20261013_0200.dump ~/backups/daily/lsms_20261013_0200.dump" >> analysis\steps\17a-safebox-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---DUMP-INASOMEKA-idadi-ya-TABLE-DATA--- >> analysis\steps\17a-safebox-pakua-dump.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_restore -l < /tmp/staging-restore/lsms_20261013_0200.dump | grep -c 'TABLE DATA'" >> analysis\steps\17a-safebox-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---LINGANISHA-BYTE-KWA-BYTE--- >> analysis\steps\17a-safebox-pakua-dump.log
ssh contabo "cmp /tmp/staging-restore/lsms_20261013_0200.dump ~/backups/daily/lsms_20261013_0200.dump && echo SHA_SAWA" >> analysis\steps\17a-safebox-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo Imekamilika. Matokeo: analysis\steps\17a-safebox-pakua-dump.log
goto end
:fail
echo ---IMESHINDWA--- >> analysis\steps\17a-safebox-pakua-dump.log
echo IMESHINDWA - soma analysis\steps\17a-safebox-pakua-dump.log. Usiendelee na hatua ya 17b.
:end
