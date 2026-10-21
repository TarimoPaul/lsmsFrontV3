@echo off
echo HATUA 35a0 IMESIMAMISHWA 15/10 - tumia analysis\steps\35-pakua-dump-20261015.cmd. Hakuna kilichoendeshwa.
goto :eof
rem HATUA 35a0 - CONTABO, KUSOMA TU. Kabla ya kuandika 35a (pg_dump ya adhoc), soma jinsi backup ya usiku inavyofanya kazi.
rem Haigusi database yoyote (hakuna psql, hakuna pg_dump), haibadilishi faili wala container.
rem Kitu pekee kinachoandikwa kwenye Contabo: kichujio /tmp/ficha-lsms.awk (nakala ya analysis\steps\ficha.awk, hakina siri),
rem kinafutwa mwishoni hata hatua ikishindwa.
rem KILA output inapita kwenye kichujio KABLA ya kutoka kwenye server: mistari ya .env, thamani za siri za .env,
rem URL zenye user:pass@, *_ACCOUNT_ID na majina ya PASS/SECRET/TOKEN/KEY yanafichwa.
rem 0) kipimo cha kichujio (lazima kionyeshe ***FICHWA*** na .env 2 zilizosomwa)
rem 1) crontab na ~/backup-lsms.sh
rem 2) dump 6 za mwisho za usiku na ukubwa wake
rem 3) nafasi ya disk (df -h) na RAM (free -m)
rem 4) folda ya adhoc ipo? (~/backups/adhoc na /backups)
rem 5) docker compose ps ya prod
rem 6) toleo la Flyway kutoka LOG ya backend (si query ya DB)
rem Matokeo: analysis\steps\35a0-soma-backup-script.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---KICHUJIO-KWENDA-CONTABO--- > analysis\steps\35a0-soma-backup-script.log
scp analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> analysis\steps\35a0-soma-backup-script.log 2>&1
if errorlevel 1 goto fail
echo ---KIPIMO-CHA-KICHUJIO--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "set -o pipefail; printf 'KIPIMO_PASSWORD=abc123\nhttps://mtu:siri99@mfano.com\nX_ACCOUNT_ID=777\nmstari wa kawaida\n' | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
if errorlevel 1 goto fail
echo ---TAREHE-NA-SERVER--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "set -o pipefail; { date '+[%%F %%T %%Z]'; whoami; hostname; } 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
if errorlevel 1 goto fail
echo ---CRONTAB--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "set -o pipefail; crontab -l 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
if errorlevel 1 goto fail
echo ---BACKUP-SCRIPT--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "set -o pipefail; { ls -l ~/backup-lsms.sh && cat ~/backup-lsms.sh; } 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
if errorlevel 1 goto fail
echo ---DUMP-ZA-USIKU--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "set -o pipefail; ls -lt ~/backups/daily 2>&1 | head -7 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
if errorlevel 1 goto fail
echo ---DISK--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "set -o pipefail; df -h ~ ~/backups/daily 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
if errorlevel 1 goto fail
echo ---RAM--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "set -o pipefail; free -m 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
if errorlevel 1 goto fail
echo ---FOLDA-ADHOC--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "{ ls -ld ~/backups ~/backups/adhoc /backups; true; } 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
echo ---PROD-COMPOSE-PS--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "set -o pipefail; cd ~/lsms-deployment && docker compose ps 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
if errorlevel 1 goto fail
echo ---FLYWAY-KUTOKA-LOG-YA-BACKEND--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "cd ~/lsms-deployment && docker compose logs --no-color backend 2>&1 | grep -E 'Current version of schema|Successfully applied|is up to date' | tail -5 | cut -c1-300 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
echo ---KICHUJIO-KIMEFUTWA--- >> analysis\steps\35a0-soma-backup-script.log
ssh contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> analysis\steps\35a0-soma-backup-script.log 2>&1
echo ---OK--- >> analysis\steps\35a0-soma-backup-script.log
echo OK. Matokeo: analysis\steps\35a0-soma-backup-script.log
goto end
:fail
ssh contabo "rm -f /tmp/ficha-lsms.awk" >> analysis\steps\35a0-soma-backup-script.log 2>&1
echo ---IMESHINDWA--- >> analysis\steps\35a0-soma-backup-script.log
echo IMESHINDWA - soma analysis\steps\35a0-soma-backup-script.log
:end
