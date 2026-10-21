@echo off
rem HATUA 33 - UKAGUZI WA GL: KUPAKUA DUMP YA PROD YA 2026-10-14 02:00 KUJA PC. KUSOMA TU.
rem Haigusi database yoyote wala container yoyote kwenye Contabo. Haitumii staging wala prod DB.
rem 1) sha256 ya nakala ya Contabo (~/backups/daily) na ya B2 (rclone cat | sha256sum) - lazima zilingane.
rem 2) scp nakala ya Contabo kuja D:\MY PROJECT\DUKA PROJECT\backups\lsms_20261014_0200.dump
rem 3) sha256 ya faili kwenye PC (certutil) - Claude ataikagua dhidi ya ya Contabo/B2.
rem Matokeo: analysis\steps\33-gl-audit-pakua-dump.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---SHA256-CONTABO--- > analysis\steps\33-gl-audit-pakua-dump.log
ssh contabo "ls -l ~/backups/daily/lsms_20261014_0200.dump && sha256sum ~/backups/daily/lsms_20261014_0200.dump" >> analysis\steps\33-gl-audit-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---SHA256-B2--- >> analysis\steps\33-gl-audit-pakua-dump.log
ssh contabo "rclone cat b2:elikom-lsms-backups/daily/lsms_20261014_0200.dump | sha256sum" >> analysis\steps\33-gl-audit-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---SCP-KUJA-PC--- >> analysis\steps\33-gl-audit-pakua-dump.log
scp contabo:backups/daily/lsms_20261014_0200.dump "D:\MY PROJECT\DUKA PROJECT\backups\lsms_20261014_0200.dump" >> analysis\steps\33-gl-audit-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---SHA256-PC--- >> analysis\steps\33-gl-audit-pakua-dump.log
certutil -hashfile "D:\MY PROJECT\DUKA PROJECT\backups\lsms_20261014_0200.dump" SHA256 >> analysis\steps\33-gl-audit-pakua-dump.log 2>&1
if errorlevel 1 goto fail
echo ---MWISHO--- >> analysis\steps\33-gl-audit-pakua-dump.log
echo Imekamilika. Matokeo: analysis\steps\33-gl-audit-pakua-dump.log
goto end
:fail
echo ---IMESHINDWA--- >> analysis\steps\33-gl-audit-pakua-dump.log
echo IMESHINDWA - soma analysis\steps\33-gl-audit-pakua-dump.log
:end
