#!/usr/bin/env bash
# HATUA 77 (mmiliki 09/11 di), Contabo, KUSOMA TU. Hakuna kinachobadilika.
# 1) dump za usiku 09/11 na 08/11: pg_restore --list (idadi ya entries) + kusoma faili LOTE (pg_restore -f /dev/null),
#    kwa stdin SAHIHI: docker compose exec -T postgres ... < faili  (76 ya awali ilifuta stdin - kosa la 76, si la dump)
# 2) DB ya staging haijaguswa na refresh-db iliyoshindwa: ps, Flyway, idadi na tarehe za mwisho.
set -u
cd /home/chief/lsms-staging || { echo "HAIPO lsms-staging"; exit 1; }
for d in lsms_20261109_0200.dump lsms_20261108_0200.dump; do
  f=/home/chief/backups/daily/$d
  echo "=== $d bytes $(stat -c %s "$f" 2>/dev/null) sha256 $(sha256sum "$f" | cut -c1-16)"
  head -c 5 "$f" | od -c | head -1 | sed 's/^/kichwa: /'
  n=$(docker compose -p lsms-staging exec -T postgres pg_restore --list < "$f" | grep -vc '^;'); echo "LIST_ENTRIES $n (exit ${PIPESTATUS[0]})"
  docker compose -p lsms-staging exec -T postgres pg_restore -f /dev/null < "$f"; echo "KUSOMA_LOTE exit $?"
  t=$(docker compose -p lsms-staging exec -T postgres pg_restore --list < "$f" | grep -c 'TABLE DATA'); echo "TABLE_DATA $t"
done
echo "=== STAGING (haijaguswa?)"
docker compose -p lsms-staging ps --format '{{.Service}} {{.Image}} {{.Status}}'
q() { docker compose -p lsms-staging exec -T postgres sh -c "psql -X -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -At -c \"$1\""; }
echo "flyway_max $(q "select max(installed_rank)||'/'||max(version::int) from flyway_schema_history where version ~ '^[0-9]+\$'")"
echo "sales $(q 'select count(*) from sales') | max sale_date $(q 'select max(sale_date) from sales') | users $(q 'select count(*) from users')"
echo "db_created/oid: $(q "select datname||' '||oid from pg_database where datname=current_database()")"
ls -la /home/chief/lsms-240/staging/ 2>&1 | head
echo "---77_SERVER_MWISHO---"
