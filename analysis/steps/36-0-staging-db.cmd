@echo off
rem HATUA 36-0 - KUSOMA TU. Inathibitisha postgres ya STAGING kabla ya hatua 36. HAIWASHI, HAIZIMI, HAIBADILISHI CHOCHOTE
rem (wala staging wala prod): ni ps / inspect / logs / free / df, na SELECT ndani ya transaction ya READ ONLY tu.
rem Sababu (19/10): hatua 36 ilishindwa kwa "service "postgres" is not running" (iliandikwa kwenye 36-h2-data.txt, si kwenye log).
rem Inaonyesha:
rem  1) toleo la staging; containers zote za staging pamoja na zilizosimama (ps -a)
rem  2) container ya postgres: jina, hali, exit code, OOMKilled, ilianza/iliisha lini, restarts
rem  3) mistari 40 ya mwisho ya log ya postgres ya staging (sababu ya kusimama)
rem  4) RAM na disk ya Contabo (free -m, df -h)
rem  5) ikiwa inaendesha: DB, user, toleo, SELECT 1, orodha ya DB (READ ONLY)
rem  6) prod ps (lazima isibadilike)
rem Matokeo: analysis\steps\36-0-staging-db.log. Kila sehemu ina [exit N]; stdout na stderr zote zinapita kwenye ficha.awk.
setlocal
cd /d "D:\MY PROJECT\DUKA PROJECT\LsmsVersion3\lsmsFrontV3"
set L=analysis\steps\36-0-staging-db.log
set F=-v envs='/home/chief/lsms-deployment/.env /home/chief/lsms-staging/.env' -f /tmp/ficha-lsms.awk
echo ---MWENDESHO-36-0--- > %L%

echo ---KICHUJIO-KWENDA-CONTABO--- >> %L%
scp analysis\steps\ficha.awk contabo:/tmp/ficha-lsms.awk >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%
if not "%RC%"=="0" goto fail

echo ---STAGING-TOLEO--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-staging && grep '^BACKEND_VERSION=' .env; } 2>&1 | awk %F%" >> %L% 2>&1
echo [exit %errorlevel%] >> %L%

echo ---STAGING-PS-A (zote, pamoja na zilizosimama)--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging ps -a --format 'table {{.Name}} {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
echo [exit %errorlevel%] >> %L%

echo ---POSTGRES-YA-STAGING: INSPECT--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-staging && C=$(docker compose -p lsms-staging ps -a -q postgres) && echo container_id=$C && docker inspect --format 'jina={{.Name}} hali={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} ilianza={{.State.StartedAt}} iliisha={{.State.FinishedAt}} restarts={{.RestartCount}} kosa={{.State.Error}} health={{if .State.Health}}{{.State.Health.Status}}{{end}}' $C; } 2>&1 | awk %F%" >> %L% 2>&1
echo [exit %errorlevel%] >> %L%

echo ---POSTGRES-YA-STAGING: LOG (mistari 40 ya mwisho)--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging logs --no-color --tail 40 postgres; } 2>&1 | cut -c1-300 | awk %F%" >> %L% 2>&1
echo [exit %errorlevel%] >> %L%

echo ---CONTABO-RAM-NA-DISK--- >> %L%
ssh contabo "set -o pipefail; { uptime; free -m; df -h / /var/lib/docker 2>/dev/null; } 2>&1 | awk %F%" >> %L% 2>&1
echo [exit %errorlevel%] >> %L%

echo ---DB-YA-STAGING-READ-ONLY (ikiwa postgres inaendesha)--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-staging && docker compose -p lsms-staging exec -T postgres psql -X -q -U postgres -d Lsms -At -v ON_ERROR_STOP=1; } 2>&1 | awk %F%" < analysis\steps\36-0-staging-db.sql >> %L% 2>&1
set RC=%errorlevel%
echo [exit %RC%] >> %L%

echo ---PROD-PS (kusoma tu)--- >> %L%
ssh contabo "set -o pipefail; { cd ~/lsms-deployment && docker compose ps --format 'table {{.Service}} {{.Image}} {{.Status}}'; } 2>&1 | awk %F%" >> %L% 2>&1
echo [exit %errorlevel%] >> %L%

echo ---KICHUJIO-KIMEFUTWA--- >> %L%
ssh contabo "rm -f /tmp/ficha-lsms.awk && echo /tmp/ficha-lsms.awk imefutwa" >> %L% 2>&1
findstr /b /l /c:"SELECT1|1" %L% > nul
if errorlevel 1 (
  echo ---POSTGRES-YA-STAGING-HAIJIBU: soma sehemu za INSPECT na LOG--- >> %L%
  echo ---IMESHINDWA--- >> %L%
  echo POSTGRES YA STAGING HAIJIBU - soma %L% ^(INSPECT na LOG zinaonyesha sababu^). Usiendeshe 36.
  goto end
)
echo ---OK--- >> %L%
echo OK - postgres ya staging inajibu. Matokeo: %L%. Sasa unaweza kuendesha 36.
goto end
:fail
ssh contabo "rm -f /tmp/ficha-lsms.awk" >> %L% 2>&1
echo ---IMESHINDWA--- >> %L%
echo IMESHINDWA - soma %L%
:end
endlocal
