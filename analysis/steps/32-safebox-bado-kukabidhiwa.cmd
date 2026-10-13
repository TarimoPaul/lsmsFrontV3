@echo off
rem HATUA 32 - PROD, KUSOMA TU. Haibadilishi chochote. SQL: safebox-bado-kukabidhiwa.sql (READ ONLY, inaishia ROLLBACK).
rem Orodha ya "Bado kukabidhiwa": kila entry ya Sefu ambayo haijathibitishwa yote, kwa recon za HALI ZOTE
rem (skrini na bango vinaonyesha siku zilizoidhinishwa tu - hapa zinaonekana na zile ambazo hazijaidhinishwa).
rem   imewasilishwa = imethibitishwa + inasubiri ;  haijawasilishwa = kiasi - imethibitishwa - inasubiri
rem Mistari ya log (ya zamani kwanza):
rem   JUMLA|entries|kiasi|imewasilishwa|imethibitishwa|inasubiri|haijawasilishwa|haijathibitishwa
rem   KWA_HALI|IMEIDHINISHWA au HAIJAIDHINISHWA|hali ya recon|entries|kiasi|imewasilishwa|imethibitishwa|inasubiri|haijawasilishwa|haijathibitishwa
rem   KWA_CASHIER|jina|entries|haijawasilishwa|inasubiri|haijathibitishwa|umri mkubwa zaidi (siku)
rem   ENTRY|tarehe ya recon|umri (siku)|cashier|kiasi|imewasilishwa|imethibitishwa|inasubiri|haijawasilishwa|hali ya recon|IMEIDHINISHWA au HAIJAIDHINISHWA
rem Matokeo: analysis\steps\32-safebox-bado-kukabidhiwa.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---PROD-BADO-KUKABIDHIWA--- > analysis\steps\32-safebox-bado-kukabidhiwa.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-bado-kukabidhiwa.sql >> analysis\steps\32-safebox-bado-kukabidhiwa.log 2>&1
echo ---MWISHO--- >> analysis\steps\32-safebox-bado-kukabidhiwa.log
echo Imekamilika. Matokeo: analysis\steps\32-safebox-bado-kukabidhiwa.log
