@echo off
rem HATUA 20 - KUSOMA TU, STAGING PEKEE, kupitia tunnel (localhost:8081). Tunnel lazima iwe wazi.
rem Inaingia kama root@system.com na kusoma API ya Sefu ya backend 2.2.69 (GET tu): my-outstanding, outstanding,
rem pending, my-pending, eligible-recipients, na recon zinazosubiri kuidhinishwa. Haiandiki chochote kwenye DB.
rem Itakuuliza password ya root. Haihifadhiwi kwenye faili lolote wala kwenye log.
rem Matokeo: analysis\steps\20-safebox-api-soma.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set /p ROOT_PASS=Password ya root@system.com (staging):
node analysis\steps\safebox-api-soma.mjs > analysis\steps\20-safebox-api-soma.log 2>&1
set ROOT_PASS=
echo Imekamilika. Matokeo: analysis\steps\20-safebox-api-soma.log
