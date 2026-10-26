#!/usr/bin/env bash
# HATUA 53 (mmiliki 22/10 19:xx) - USHAHIDI: kwa nini admin@admin.com ni ACTIVE baada ya restart ya 45i (19:07). KUSOMA TU.
# Inaendeshwa kwenye Contabo na 53-prod-admin-ushahidi.cmd (scp -> /tmp; output -> ficha.awk). Hakuna restart, hakuna kuandika:
# psql ya DB ya prod iko ndani ya transaction ya READ ONLY (default_transaction_read_only=on) - mmiliki ameiruhusu wazi 22/10.
#  1) log ya backend ya boot ya 19:06:30-19:12 - DataInitializer / Runner / Initializer / root / admin / users / status / ACTIVE
#  2) DB: users (admin@admin.com, root@system.com, kila is_root) bila safu za siri; roles; jedwali za audit/log/token/session
#     zinazotaja admin (idadi; mistari ya audit/log tu - token/session: idadi na tarehe tu)
#  3) compose: service zipi zinarejelea ROOT_EMAIL / ROOT_PASSWORD; majina (si thamani) ya ADMIN/DEFAULT/SEED/INIT/ROOT/... kwenye .env,
#     compose na mazingira ya backend
#  4) nginx tangu 21/10 15:00: maombi yote ya kuandika kwenye /api/users (status / approve / ...) - njia pekee nyingine ya ACTIVE
set -u -o pipefail
cd ~/lsms-deployment || exit 1
PSQL() { docker compose exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on" psql -X -q -v ON_ERROR_STOP=1 -At -F"|" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"'; }

echo "---1-LOG-YA-BOOT-YA-BACKEND-19:06:30-19:12---"
C=$(docker compose ps -q backend)
docker inspect -f 'container {{.Name}} ilianza {{.State.StartedAt}} (UTC) image {{.Config.Image}} restarts {{.RestartCount}}' "$C"
docker compose logs --no-color --since 2026-10-22T19:06:30+03:00 --until 2026-10-22T19:12:00+03:00 backend > /tmp/53-boot.txt 2>&1
echo "mistari yote ya log ya kipindi hicho: $(wc -l < /tmp/53-boot.txt)"
echo "mistari inayolingana (DataInitializer|Runner|Initializer|root|admin|user|status|ACTIVE), namba ya mstari kwanza:"
grep -n -i -E 'DataInitializer|Runner|Initiali[sz]|IntegrityChecker|root|admin|users?\b|status|ACTIVE' /tmp/53-boot.txt \
  | sed -E 's/^([0-9]+:)[^|]*\| /\1/' | cut -c1-260 | head -n 300
rm -f /tmp/53-boot.txt

echo "---2-DB-KUSOMA-TU---"
PSQL <<'SQL' || { echo "SIYO: psql ya kusoma imeshindwa"; exit 1; }
SELECT 'READ_ONLY|' || current_setting('transaction_read_only');
SELECT 'SAA_YA_DB|' || now()::text;
SELECT 'USER|' || u.email || '|' || (SELECT jsonb_object_agg(k, v) FROM jsonb_each(to_jsonb(u)) AS e(k, v)
                                     WHERE k !~* '(pass|token|secret|otp|pin|hash|salt)')::text
  FROM users u WHERE u.email IN ('admin@admin.com', 'root@system.com') OR u.is_root ORDER BY u.email;
SELECT 'ROLES|' || u.email || '|' || coalesce(string_agg(r.name, ',' ORDER BY r.name), '-')
  FROM users u LEFT JOIN user_roles ur ON ur.user_uid = u.uid LEFT JOIN roles r ON r.uid = ur.role_uid
 WHERE u.email IN ('admin@admin.com', 'root@system.com') GROUP BY u.email ORDER BY u.email;
SELECT 'JEDWALI|' || table_name FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name ~* '(audit|history|log|token|session|login|attempt)' ORDER BY 1;
-- kila jedwali hilo: idadi ya mistari inayotaja admin (email au uid) na tarehe ya mwisho (ikiwa safu ya created_at ipo)
WITH a AS (SELECT uid FROM users WHERE email = 'admin@admin.com')
SELECT format('SELECT %L || count(*) || %L || coalesce(%s, %L) FROM public.%I t WHERE t::text ILIKE %L OR t::text ILIKE %L',
              'MAREJEO|' || t.table_name || '|', '|mwisho ',
              CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'created_at')
                   THEN 'max(t.created_at)::text' ELSE 'NULL' END, '-',
              t.table_name, '%admin@admin.com%', '%' || a.uid || '%')
  FROM information_schema.tables t, a
 WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND t.table_name ~* '(audit|history|log|token|session|login|attempt)'
 ORDER BY t.table_name
\gexec
-- mistari yenyewe ya audit/log tu (si token/session - zina siri) tangu 21/10, 20 kwa kila jedwali, herufi 400
WITH a AS (SELECT uid FROM users WHERE email = 'admin@admin.com')
SELECT format('SELECT %L || left(t::text, 400) FROM public.%I t WHERE (t::text ILIKE %L OR t::text ILIKE %L)%s LIMIT 20',
              'MSTARI|' || t.table_name || '|', t.table_name, '%admin@admin.com%', '%' || a.uid || '%',
              CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = 'created_at')
                   THEN ' AND t.created_at >= ''2026-10-21''' ELSE '' END)
  FROM information_schema.tables t, a
 WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND t.table_name ~* '(audit|history|log)' AND t.table_name !~* '(token|session)'
 ORDER BY t.table_name
\gexec
SQL

echo "---3-COMPOSE-NA-MAJINA-YA-VARIABLES (majina tu, si thamani)---"
for f in docker-compose*.yml docker-compose*.yaml compose*.yml compose*.yaml; do
  [ -f "$f" ] || continue
  echo "faili $f: marejeo ya ROOT_EMAIL / ROOT_PASSWORD kwa service"
  awk '/^services:/ { s = 1; next } s && /^[^ #]/ { s = 0; svc = "" }
       s && /^  [A-Za-z0-9_.-]+:/ { svc = $1; sub(/:$/, "", svc) }
       /ROOT_(EMAIL|PASSWORD)/ { n = 0; out = ""; t = $0
         while (match(t, /[A-Z0-9_]*ROOT_(EMAIL|PASSWORD)[A-Z0-9_]*/)) { out = out " " substr(t, RSTART, RLENGTH); t = substr(t, RSTART + RLENGTH) }
         printf "  service %s mstari %d:%s\n", (svc == "" ? "(nje ya services)" : svc), NR, out }' "$f"
  echo "faili $f: majina yanayolingana na ADMIN|DEFAULT|SEED|INIT|ROOT|BOOTSTRAP|SUPER|DATA_INITIALI"
  grep -oE '[A-Z][A-Z0-9_]{2,}' "$f" | sort -u | grep -E 'ADMIN|DEFAULT|SEED|INIT|ROOT|BOOTSTRAP|SUPER' | sed 's/^/  /'
done
echo ".env: majina yanayolingana"
grep -oE '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' .env | tr -d ' =' | sort -u | grep -iE 'ADMIN|DEFAULT|SEED|INIT|ROOT|BOOTSTRAP|SUPER' | sed 's/^/  /'
echo "backend (mazingira ya container): majina yanayolingana na SPRING_*"
docker compose exec -T backend sh -c 'env | cut -d= -f1' < /dev/null | sort -u | grep -iE 'ADMIN|DEFAULT|SEED|INIT|ROOT|BOOTSTRAP|SUPER|^SPRING_|^APP_' | sed 's/^/  /'

echo "---4-NGINX-TANGU-2026-10-21-15:00: MAOMBI YA KUANDIKA KWENYE /api/users (saa ya nginx ni UTC; EAT = UTC+3)---"
docker compose logs --no-color --since 2026-10-21T15:00:00+03:00 nginx 2>/dev/null | sed -E 's/^[^|]*\| //' \
  | awk '$6 ~ /"(PUT|POST|PATCH|DELETE)/ && $7 ~ /^\/api\/users/ { print "  " substr($4, 2), $1, substr($6, 2), $7, "HTTP_" $9 }' | head -n 200
echo "(mwisho wa orodha ya /api/users)"
echo "---USHAHIDI_53_UMEKAMILIKA---"
exit 0
