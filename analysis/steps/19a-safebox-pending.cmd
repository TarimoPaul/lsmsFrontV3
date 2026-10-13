@echo off
rem HATUA 19a - KUSOMA TU, STAGING PEKEE. Haibadilishi chochote. SQL: safebox-pending.sql (READ ONLY, inaishia ROLLBACK).
rem Kwa nini: log ya 19 inaonyesha deposit moja PENDING (110,000) lakini pending_total ya "bado unadaiwa" ni 0,
rem na entries - confirmed = 15,000 wakati salio la "bado unadaiwa" ni 25,500.
rem Inaonyesha: deposit ya PENDING imefungwa na entry/recon ipi, entries za SAFE_BOX kwa status ya recon,
rem deposits CONFIRMED zisizo na entry hai, na entries ambazo confirmed imezidi kiasi cha entry.
rem Matokeo: analysis\steps\19a-safebox-pending.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---STAGING-PENDING-NA-TOFAUTI--- > analysis\steps\19a-safebox-pending.log
ssh contabo "cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-pending.sql >> analysis\steps\19a-safebox-pending.log 2>&1
echo ---MWISHO--- >> analysis\steps\19a-safebox-pending.log
echo Imekamilika. Matokeo: analysis\steps\19a-safebox-pending.log
