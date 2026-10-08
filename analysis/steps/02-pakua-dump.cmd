@echo off
rem HATUA 02 - KUPAKUA DUMP YA LEO KUTOKA B2 + SHA256. Haigusi database yoyote wala container yoyote.
rem Kinachobadilika: faili moja la muda kwenye Contabo, /tmp/staging-restore/lsms_20261007_0200.dump
rem Matokeo: analysis\steps\02-pakua-dump.log   (mstari wa mwisho uwe SHA_SAWA)
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---PAKUA-KUTOKA-B2--- > analysis\steps\02-pakua-dump.log
ssh contabo "mkdir -p /tmp/staging-restore && rclone copyto b2:elikom-lsms-backups/daily/lsms_20261007_0200.dump /tmp/staging-restore/lsms_20261007_0200.dump && ls -l /tmp/staging-restore" >> analysis\steps\02-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---SHA256-B2-NA-NAKALA-YA-CONTABO--- >> analysis\steps\02-pakua-dump.log
ssh contabo "sha256sum /tmp/staging-restore/lsms_20261007_0200.dump ~/backups/daily/lsms_20261007_0200.dump" >> analysis\steps\02-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---DUMP-INASOMEKA-idadi-ya-TABLE-DATA--- >> analysis\steps\02-pakua-dump.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres pg_restore -l < /tmp/staging-restore/lsms_20261007_0200.dump | grep -c 'TABLE DATA'" >> analysis\steps\02-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---LINGANISHA-BYTE-KWA-BYTE--- >> analysis\steps\02-pakua-dump.log
ssh contabo "cmp /tmp/staging-restore/lsms_20261007_0200.dump ~/backups/daily/lsms_20261007_0200.dump && echo SHA_SAWA" >> analysis\steps\02-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo Imekamilika. Matokeo: analysis\steps\02-pakua-dump.log
goto end
:fail
echo ---IMESHINDWA--- >> analysis\steps\02-pakua-dump.log
echo IMESHINDWA - soma analysis\steps\02-pakua-dump.log. Usiendelee na hatua ya 03.
:end
