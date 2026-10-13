@echo off
rem HATUA 30 - PROD, KUSOMA TU. Haibadilishi chochote. SQL: safebox-si-mmiliki.sql (READ ONLY, inaishia ROLLBACK).
rem Orodha ya deposits za Safe Box ambazo aliyeziwasilisha SI mmiliki wa recon ya entry hiyo.
rem Jedwali ni dogo (deposits ~100), query ni nyepesi.
rem Mistari ya log:
rem   DEPOSITS_ZOTE|idadi|jumla
rem   SI_MMILIKI_JUMLA|idadi|jumla          (0 = hakuna, sawa)
rem   SI_MMILIKI_KWA_HALI|hali|idadi|jumla
rem   SI_MMILIKI|iliwasilishwa lini|tarehe ya recon|kiasi|kiasi cha entry|aina|aliyewasilisha|mmiliki|hali|HAI au IMEFUTWA|uid ya deposit
rem Matokeo: analysis\steps\30-safebox-si-mmiliki.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---PROD-DEPOSITS-ZA-ASIYE-MMILIKI--- > analysis\steps\30-safebox-si-mmiliki.log
ssh contabo "cd ~/lsms-deployment && docker compose exec -T postgres psql -X -q -U postgres -d Lsms -At" < analysis\steps\safebox-si-mmiliki.sql >> analysis\steps\30-safebox-si-mmiliki.log 2>&1
echo ---MWISHO--- >> analysis\steps\30-safebox-si-mmiliki.log
echo Imekamilika. Matokeo: analysis\steps\30-safebox-si-mmiliki.log
