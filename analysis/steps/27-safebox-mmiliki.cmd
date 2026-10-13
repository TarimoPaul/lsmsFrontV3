@echo off
rem HATUA 27 - STAGING TU, kupitia tunnel (localhost:8081). Tunnel lazima iwe wazi. Production HAIGUSWI.
rem Swali: nani anaweza kuwasilisha deposit kwenye entry ya Sefu ya macheda?
rem Inaingia kwa email + password utakazoandika, kisha inajaribu deposit ya 1,000 kwenye entry ya macheda
rem ya 2026-08-18 (imebaki 4,500). Deposit ikikubaliwa, script inaifuta papo hapo (CANCELLED, inabaki kwenye historia).
rem Inakataa root@system.com na macheda mwenyewe. Password haihifadhiwi kwenye faili lolote wala kwenye log.
rem Endesha hivi:
rem   a) Sasa, staging 2.2.69, user wa KAWAIDA (cashier/meneja asiye CEO)  -> natarajia IMEKUBALIWA (ndilo kosa la 2.2.69)
rem   b) Baada ya hatua 29, staging 2.2.70, user wa KAWAIDA yule yule      -> lazima IMEKATALIWA
rem   c) Baada ya hatua 29, staging 2.2.70, akaunti yako ya CEO            -> lazima IMEKUBALIWA, mmiliki macheda, kwa niaba: true
rem Matokeo: analysis\steps\27-safebox-mmiliki.log  (kila mwendesho unaongezwa chini, haufuti wa awali)
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set /p QA_EMAIL=Email ya user (staging):
set /p QA_PASS=Password yake:
echo ---MWENDESHO %DATE% %TIME%--- >> analysis\steps\27-safebox-mmiliki.log
ssh contabo "cd ~/lsms-staging && grep BACKEND_VERSION .env" >> analysis\steps\27-safebox-mmiliki.log 2>&1
node analysis\steps\safebox-mmiliki-staging.mjs >> analysis\steps\27-safebox-mmiliki.log 2>&1
set QA_PASS=
set QA_EMAIL=
echo Imekamilika. Matokeo: analysis\steps\27-safebox-mmiliki.log
