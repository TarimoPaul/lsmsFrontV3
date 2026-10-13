@echo off
rem HATUA 21 - INAANDIKA KWENYE STAGING TU, kupitia tunnel (localhost:8081). Production HAIGUSWI.
rem Tunnel lazima iwe wazi, na V3 ya PC iwe hai kwenye http://localhost:3456.
rem Inaingia kama root@system.com (backend 2.2.69) na kufanya haya kwenye DB ya staging:
rem   1. Recon ya macheda ya 2026-10-11: review + approve (ina deposit ya 110,000 inayosubiri kati ya 140,000).
rem   2. Inawasilisha nusu: deposit ya 10,000 kati ya 21,000 (recon ya 2026-06-29), NMB, sababu "QA: chenchi".
rem   3. Inajaribu deposit ya pili ya 12,000 (inazidi 11,000 iliyobaki) - inatakiwa ikataliwe.
rem   4. Inafungua V3 kwenye Chrome isiyoonekana: bango la meneja + tab ya Sefu, picha kwenye analysis\steps\safebox-shots\
rem   5. Inathibitisha deposit ya 10,000.
rem Itakuuliza password ya root. Haihifadhiwi kwenye faili lolote wala kwenye log.
rem Matokeo: analysis\steps\21-safebox-jaribu.log   (mstari wa mwisho: N/N passed)
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set /p ROOT_PASS=Password ya root@system.com (staging):
node analysis\steps\safebox-jaribu-staging.mjs > analysis\steps\21-safebox-jaribu.log 2>&1
set ROOT_PASS=
echo Imekamilika. Matokeo: analysis\steps\21-safebox-jaribu.log
