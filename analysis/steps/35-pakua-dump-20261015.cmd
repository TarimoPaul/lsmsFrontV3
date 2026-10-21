@echo off
rem HATUA 35 - CAPITAL/GL: KUPAKUA DUMP YA USIKU YA PROD YA 2026-10-15 02:00 KUJA PC. KUSOMA TU.
rem Nakala ya hatua 33 (tarehe tu imebadilika), pamoja na kanuni za 15/10:
rem  - KILA output ya ssh inapita kwenye kichujio /tmp/ficha-lsms.awk (nakala ya analysis\steps\ficha.awk) KABLA ya kutoka
rem    kwenye server; kichujio kinafutwa mwishoni hata hatua ikishindwa.
rem  - kama faili tayari lipo kwenye PC, hatua inasimama (haiandiki juu ya faili lililopo).
rem Haigusi database yoyote wala container yoyote kwenye Contabo. Haitumii staging wala prod DB.
rem 1) sha256 ya nakala ya Contabo (~/backups/daily) na ya B2 (rclone cat | sha256sum) - lazima zilingane.
rem 2) scp nakala ya Contabo kuja D:\MY PROJECT\DUKA PROJECT\backups\lsms_20261015_0200.dump
rem 3) sha256 ya faili kwenye PC (certutil) - Claude ataikagua dhidi ya ya Contabo/B2.
rem Matokeo: analysis\steps\35-pakua-dump-20261015.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---FAILI-LA-PC-HALIPO-BADO--- > analysis\steps\35-pakua-dump-20261015.log
if exist "D:\MY PROJECT\DUKA PROJECT\backups\lsms_20261015_0200.dump" goto ipo
echo sawa: faili halipo, hakuna kitakachoandikwa juu >> analysis\steps\35-pakua-dump-20261015.log
echo ---KICHUJIO-KWENDA-CONTABO--- >> analysis\steps\35-pakua-dump-20261015.log
scp analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> analysis\steps\35-pakua-dump-20261015.log 2>&1
if errorlevel 1 goto fail
echo ---SHA256-CONTABO--- >> analysis\steps\35-pakua-dump-20261015.log
ssh contabo "set -o pipefail; { ls -l ~/backups/daily/lsms_20261015_0200.dump && sha256sum ~/backups/daily/lsms_20261015_0200.dump; } 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35-pakua-dump-20261015.log 2>&1
if errorlevel 1 goto fail
echo ---SHA256-B2--- >> analysis\steps\35-pakua-dump-20261015.log
ssh contabo "set -o pipefail; { rclone cat b2:elikom-lsms-backups/daily/lsms_20261015_0200.dump | sha256sum; } 2>&1 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\35-pakua-dump-20261015.log 2>&1
if errorlevel 1 goto fail
echo ---SCP-KUJA-PC--- >> analysis\steps\35-pakua-dump-20261015.log
scp contabo:backups/daily/lsms_20261015_0200.dump "D:\MY PROJECT\DUKA PROJECT\backups\lsms_20261015_0200.dump" >> analysis\steps\35-pakua-dump-20261015.log 2>&1
if errorlevel 1 goto fail
echo ---SHA256-PC--- >> analysis\steps\35-pakua-dump-20261015.log
certutil -hashfile "D:\MY PROJECT\DUKA PROJECT\backups\lsms_20261015_0200.dump" SHA256 >> analysis\steps\35-pakua-dump-20261015.log 2>&1
if errorlevel 1 goto fail
echo ---KICHUJIO-KIMEFUTWA--- >> analysis\steps\35-pakua-dump-20261015.log
ssh contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> analysis\steps\35-pakua-dump-20261015.log 2>&1
echo ---OK--- >> analysis\steps\35-pakua-dump-20261015.log
echo OK. Matokeo: analysis\steps\35-pakua-dump-20261015.log
goto end
:ipo
echo faili tayari lipo kwenye PC - hatua imesimama bila kuandika juu yake >> analysis\steps\35-pakua-dump-20261015.log
echo ---IMESHINDWA--- >> analysis\steps\35-pakua-dump-20261015.log
echo IMESHINDWA - faili tayari lipo. Soma analysis\steps\35-pakua-dump-20261015.log
goto end
:fail
ssh contabo "rm -f /tmp/ficha-lsms.awk" >> analysis\steps\35-pakua-dump-20261015.log 2>&1
echo ---IMESHINDWA--- >> analysis\steps\35-pakua-dump-20261015.log
echo IMESHINDWA - soma analysis\steps\35-pakua-dump-20261015.log
:end
