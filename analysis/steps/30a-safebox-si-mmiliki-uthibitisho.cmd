@echo off
rem HATUA 30a - PROD, KUSOMA TU. Haibadilishi chochote. SQL: safebox-si-mmiliki-uthibitisho.sql (READ ONLY, inaishia ROLLBACK).
rem Kwa deposits 9 za hatua ya 30 (aliyewasilisha si mmiliki wa recon): nani alithibitisha na lini, nani alikabidhiwa,
rem benki + risiti, nani alifuta na kwa sababu gani.
rem Alama: ALIYEWASILISHA_NDIYE_ALIYETHIBITISHA / MTU_MWINGINE / HAIJATHIBITISHWA.
rem Mwishoni, hesabu mbili juu ya deposits ZOTE (si hizo 9 tu):
rem   ZOTE_ALIYEWASILISHA_NDIYE_ALIYETHIBITISHA|idadi|jumla
rem   ZOTE_ALIYEKABIDHIWA_NDIYE_ALIYEWASILISHA|idadi|jumla
rem Matokeo: analysis\steps\30a-safebox-si-mmiliki-uthibitisho.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---PROD-NANI-ALITHIBITISHA--- > analysis\steps\30a-safebox-si-mmiliki-uthibitisho.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-si-mmiliki-uthibitisho.sql >> analysis\steps\30a-safebox-si-mmiliki-uthibitisho.log 2>&1
echo ---MWISHO--- >> analysis\steps\30a-safebox-si-mmiliki-uthibitisho.log
echo Imekamilika. Matokeo: analysis\steps\30a-safebox-si-mmiliki-uthibitisho.log
