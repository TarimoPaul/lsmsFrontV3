@echo off
rem HATUA 27b - STAGING TU, kupitia tunnel (localhost:8081). Tunnel lazima iwe wazi. Production HAIGUSWI.
rem User wa KAWAIDA (cashier/meneja; si wewe Paul, si macheda, si root) anajaribu deposit ya 1,000 kwenye entry ya macheda.
rem Script INASIMAMA yenyewe ukiingiza akaunti yenye role CEO. Matokeo yanayotakiwa: IMEKATALIWA.
rem Kama haina password ya user wa kawaida: badilisha password ya user mmoja kwenye admin UI ya STAGING (si prod).
rem Matokeo: analysis\steps\27-safebox-mmiliki.log (yanaongezwa chini)
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set QA_MODE=KAWAIDA
set /p QA_EMAIL=Email ya user wa KAWAIDA (si tarimo, si macheda):
set /p QA_PASS=Password yake:
echo ---MWENDESHO 27b %DATE% %TIME%--- >> analysis\steps\27-safebox-mmiliki.log
ssh contabo "cd ~/lsms-staging && grep BACKEND_VERSION .env" >> analysis\steps\27-safebox-mmiliki.log 2>&1
node analysis\steps\safebox-mmiliki-staging.mjs >> analysis\steps\27-safebox-mmiliki.log 2>&1
set QA_PASS=
set QA_EMAIL=
set QA_MODE=
echo Imekamilika. Matokeo: analysis\steps\27-safebox-mmiliki.log
