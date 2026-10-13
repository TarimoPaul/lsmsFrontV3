@echo off
rem HATUA 31 - PROD, KUSOMA TU. Haibadilishi chochote. SQL: safebox-roles.sql (READ ONLY, inaishia ROLLBACK).
rem Kwa nini: V133 inaipa ruhusa mpya SAFEBOX_DEPOSIT_ON_BEHALF role yenye jina CEO. Kabla ya kujenga 2.2.70
rem tunahitaji kujua role hiyo ipo kweli na nani wanayo.
rem Mistari ya log:
rem   ROLE|jina|HAI au IMEFUTWA|idadi ya watumiaji|majina yao
rem   ROLE_CEO_MUST_BE_1|idadi          (isipokuwa 1, niambie - migration itabadilishwa kabla ya build)
rem   RUHUSA_KWA_ROLE|ruhusa|roles zenye ruhusa hiyo
rem   ALIJITHIBITISHIA|lini|kiasi|aliyewasilisha na kuthibitisha|mmiliki wa recon|aina|aliyekabidhiwa   (zile 10 za hatua 30a)
rem   ALIJIKABIDHI|lini|kiasi|aliyewasilisha na kukabidhiwa|mmiliki wa recon|hali|aliyethibitisha        (zile 3 za hatua 30a)
rem Matokeo: analysis\steps\31-safebox-roles.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---PROD-ROLES-NA-RUHUSA--- > analysis\steps\31-safebox-roles.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-roles.sql >> analysis\steps\31-safebox-roles.log 2>&1
echo ---MWISHO--- >> analysis\steps\31-safebox-roles.log
echo Imekamilika. Matokeo: analysis\steps\31-safebox-roles.log
