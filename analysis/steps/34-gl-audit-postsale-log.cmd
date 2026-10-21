@echo off
rem HATUA 34 - PROD, KUSOMA TU. Ukaguzi wa GL: kwa nini sales zenye deni hazipati journal (3 kati ya 3 tangu GL live).
rem 1) log ya backend ya sasa (tangu deploy ya 2.2.70, 14/10 14:43): mistari ya "GL postSale failed" / "GL shadow post failed"
rem    / "GL post failed" pamoja na exception yake. Log za 10-13/10 hazipo tena (container ilibadilishwa 14/10).
rem 2) (imeondolewa 15/10 - hakuna query kwenye DB ya prod; gl-audit-credit-sales.sql inaendeshwa na Claude kwenye nakala ya 35c)
rem KILA output inapita kwenye kichujio /tmp/ficha-lsms.awk (nakala ya analysis\steps\ficha.awk) KABLA ya kutoka kwenye server;
rem kichujio kinafutwa mwishoni hata hatua ikishindwa.
rem Haibadilishi chochote. Matokeo: analysis\steps\34-gl-audit-postsale-log.log
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
echo ---KICHUJIO-KWENDA-CONTABO--- > analysis\steps\34-gl-audit-postsale-log.log
scp analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> analysis\steps\34-gl-audit-postsale-log.log 2>&1
if errorlevel 1 goto fail
echo ---PROD-LOG-GL-FAILED--- >> analysis\steps\34-gl-audit-postsale-log.log
ssh contabo "cd ~/lsms-deployment && docker compose logs --no-color backend 2>&1 | grep -E -A6 'GL postSale failed|GL shadow post failed|GL post failed|LazyInitialization' | tail -80 | cut -c1-400 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\34-gl-audit-postsale-log.log 2>&1
if errorlevel 1 goto fail
echo ---PROD-LOG-IDADI--- >> analysis\steps\34-gl-audit-postsale-log.log
ssh contabo "cd ~/lsms-deployment && docker compose logs --no-color backend 2>&1 | grep -c -E 'GL postSale failed|GL shadow post failed|GL post failed'; true" >> analysis\steps\34-gl-audit-postsale-log.log 2>&1
echo ---PROD-LOG-MWANZO-WA-CONTAINER--- >> analysis\steps\34-gl-audit-postsale-log.log
ssh contabo "cd ~/lsms-deployment && docker compose logs --no-color backend 2>&1 | head -1 | cut -c1-200 | awk -v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk" >> analysis\steps\34-gl-audit-postsale-log.log 2>&1
if errorlevel 1 goto fail
echo ---KICHUJIO-KIMEFUTWA--- >> analysis\steps\34-gl-audit-postsale-log.log
ssh contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> analysis\steps\34-gl-audit-postsale-log.log 2>&1
echo ---OK--- >> analysis\steps\34-gl-audit-postsale-log.log
echo OK. Matokeo: analysis\steps\34-gl-audit-postsale-log.log
goto end
:fail
ssh contabo "rm -f /tmp/ficha-lsms.awk" >> analysis\steps\34-gl-audit-postsale-log.log 2>&1
echo ---IMESHINDWA--- >> analysis\steps\34-gl-audit-postsale-log.log
echo IMESHINDWA - soma analysis\steps\34-gl-audit-postsale-log.log
:end
