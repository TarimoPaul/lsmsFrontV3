@echo off
rem HATUA 01 - KUSOMA TU. Haibadilishi chochote kwenye Contabo (wala staging wala prod).
rem Inasoma: hali ya staging, Flyway ya staging, dump zilizopo (Contabo na B2), nafasi ya disk, STAGING.md.
rem Matokeo: analysis\steps\01-soma-staging.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-PS--- > analysis\steps\01-soma-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging ps -a" >> analysis\steps\01-soma-staging.log 2>&1
echo ---STAGING-SERVICES--- >> analysis\steps\01-soma-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging config --services" >> analysis\steps\01-soma-staging.log 2>&1
echo ---STAGING-ENV-VERSION--- >> analysis\steps\01-soma-staging.log
ssh contabo "cd ~/lsms-staging && grep BACKEND_VERSION .env" >> analysis\steps\01-soma-staging.log 2>&1
echo ---STAGING-DATABASES--- >> analysis\steps\01-soma-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -Atc 'select datname, pg_size_pretty(pg_database_size(datname)) from pg_database order by 1'" >> analysis\steps\01-soma-staging.log 2>&1
echo ---STAGING-FLYWAY-LAST-5--- >> analysis\steps\01-soma-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select version, success, installed_on from flyway_schema_history order by installed_rank desc limit 5'" >> analysis\steps\01-soma-staging.log 2>&1
echo ---STAGING-LAST-SALE--- >> analysis\steps\01-soma-staging.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -Atc 'select max(sale_date), count(*) from sales'" >> analysis\steps\01-soma-staging.log 2>&1
echo ---CONTABO-DAILY-DUMPS--- >> analysis\steps\01-soma-staging.log
ssh contabo "ls -la ~/backups/daily | tail -6" >> analysis\steps\01-soma-staging.log 2>&1
echo ---B2-DAILY-DUMPS--- >> analysis\steps\01-soma-staging.log
ssh contabo "rclone lsl b2:elikom-lsms-backups/daily/ | sort -k4 | tail -6" >> analysis\steps\01-soma-staging.log 2>&1
echo ---DISK-NA-RAM--- >> analysis\steps\01-soma-staging.log
ssh contabo "df -h ~ | tail -1; free -m | head -2" >> analysis\steps\01-soma-staging.log 2>&1
echo ---STAGING-MD--- >> analysis\steps\01-soma-staging.log
ssh contabo "sed -n 1,120p ~/lsms-staging/STAGING.md" >> analysis\steps\01-soma-staging.log 2>&1
echo ---MWISHO--- >> analysis\steps\01-soma-staging.log
echo Imekamilika. Matokeo: analysis\steps\01-soma-staging.log
