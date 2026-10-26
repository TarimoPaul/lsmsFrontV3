#!/usr/bin/env bash
# HATUA 56 (mmiliki 26/10) - KUSOMA TU: je, admin@admin.com ilitumika wakati ilikuwa ACTIVE + is_root kwa password ya awali,
#   2026-10-21 15:13:12 hadi 2026-10-26 09:20:46 EAT? Inaendeshwa KABLA ya 55, kwenye Contabo, na 56-prod-admin-tukio.cmd
#   (scp -> /tmp; output -> ficha.awk). Hakuna restart, hakuna kuandika; psql iko ndani ya transaction ya READ ONLY.
#  a) log ya backend (container ya sasa, tangu 22/10 19:07): mistari yote inayotaja admin@admin.com, login, authentication,
#     BadCredentials, locked - saa na IP (IP ni ile backend inayoiona).
#  b) nginx 21/10 15:13 -> 26/10 09:20: POST /api/auth/login kwa IP (idadi, HTTP); kila ombi la kuandika kwenye /api/users,
#     /api/roles, /api/permissions, /api/settings, /api/v1/gl/periods, /api/v1/gl/corrections, /api/v1/capital* - IP, saa, HTTP.
#     IP halisi = X-Forwarded-For (sehemu ya mwisho ya log yenye "..."), kama 45-maandishi.sh. IP isiyo 41.59.106.20 -> ALAMA.
#  c) DB READ ONLY: users, roles, permission_config, role_permissions, user_roles, permissions, settings, business_settings,
#     settings_approvals, user_branches - safu zenye created_at/updated_at ndani ya kipindi (bila safu za siri).
#  e) (mmiliki 26/10 c) dump ya 45a ~/backups/daily/lsms_20261021_1153.dump (21/10 11:53, kabla admin haijawashwa; sha256 ya 45a)
#     dhidi ya prod sasa: user_roles, role_permissions, user_branches, permission_config, roles, settings/business_settings -
#     safu zilizoongezwa / kuondolewa / kubadilika. Tofauti yoyote = ALAMA; hakuna tofauti = ushahidi mkuu E_HAKUNA_TOFAUTI_DUMP_VS_PROD.
#  d) HITIMISHO HAKUNA_USHAHIDI_WA_MATUMIZI (hakuna ALAMA hata moja) au HITIMISHO ORODHA (orodha ya ALAMA).
#     Ushahidi usiokamilika (log ya nginx haianzii mwanzo wa kipindi, au haisomeki) ni ALAMA pia - si "hakuna ushahidi".
set -u -o pipefail
cd ~/lsms-deployment || exit 1
OWNER_IP=41.59.106.20
FROM_EAT='2026-10-21 15:13:12'
TO_EAT='2026-10-26 09:20:46'
FROM_E=$(date -d "$FROM_EAT +0300" +%s) || exit 1
TO_E=$(date -d "$TO_EAT +0300" +%s) || exit 1
BACKEND_SINCE='2026-10-22T19:07:00+03:00'
eat() { TZ=EAT-3 date "$@"; }   # POSIX TZ: haitegemei tzdata ya server
W=$(mktemp -d /tmp/56-tukio.XXXXXX) || exit 1
trap 'rm -rf "$W"' EXIT
: > "$W/alama.txt"
alama() { echo "ALAMA| $*" | tee -a "$W/alama.txt"; }
PSQL() { docker compose exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120000" psql -X -q -v ON_ERROR_STOP=1 -At -F"|" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"'; }
started() { docker inspect -f '{{.State.StartedAt}}' "$(docker compose ps -q "$1" | head -n1)" 2>/dev/null; }

echo "SAA_56 $(eat '+%F %T') EAT"
echo "TAREHE_YA_56 $(eat +%Y%m%d)"
echo "KIPINDI $FROM_EAT -> $TO_EAT EAT; IP ya mmiliki $OWNER_IP"

echo "---A-LOG-YA-BACKEND-TANGU-22/10-19:07---"
BS=$(started backend)
echo "container ya backend ilianza: $BS (UTC)"
[ -n "$BS" ] || alama "a: container ya backend haikupatikana"
echo "PENGO: log ya backend ya 21/10 15:13 -> 22/10 19:07 haipo (container ilibadilishwa 22/10 19:07, 45i) - haisomeki tena"
echo "TAARIFA: backend haiandiki login ZILIZOFANIKIWA (AuthController.java:101-205 inaandika zilizoshindwa tu); maombi ya"
echo "  controllers nyingi yanaandika authentication.getName() = email ya mtumiaji - hayo ndiyo yanayotafutwa hapa."
docker compose logs --no-color --since "$BACKEND_SINCE" backend 2>/dev/null | sed -E 's/^[^|]*\| //' > "$W/b.txt"
echo "mistari yote ya log: $(wc -l < "$W/b.txt")"
[ -s "$W/b.txt" ] || alama "a: log ya backend ni tupu"
NA=$(grep -c -i -F 'admin@admin.com' "$W/b.txt" || true)
echo "mistari inayotaja admin@admin.com: $NA"
grep -n -i -F 'admin@admin.com' "$W/b.txt" | cut -c1-300
[ "${NA:-0}" = 0 ] || alama "a: admin@admin.com imetajwa mara $NA kwenye log ya backend (mistari iko juu)"
for p in 'login' 'authenticat' 'BadCredential' 'locked'; do
  echo "  '$p': $(grep -i -F "$p" "$W/b.txt" | grep -v -i -F 'admin@admin.com' | grep -c . || true) (mistari isiyotaja admin@admin.com)"
done
echo "mistari hiyo (login|authenticat|BadCredential|locked, isiyotaja admin@admin.com), 400 ya kwanza:"
grep -n -i -E 'login|authenticat|BadCredential|locked' "$W/b.txt" | grep -v -i -F 'admin@admin.com' | cut -c1-260 | head -n 400

echo "---B-NGINX-21/10-15:13-HADI-26/10-09:20---"
NS=$(started nginx)
echo "container ya nginx ilianza: $NS (UTC)"
if [ -z "$NS" ] || [ "$(date -d "$NS" +%s)" -gt "$FROM_E" ]; then
  alama "b: container ya nginx ilianza baada ya $FROM_EAT EAT (au haipatikani) - log ya mwanzo wa kipindi haipo; ushahidi haujakamilika"
fi
docker compose logs --no-color --since "$(date -u -d "@$FROM_E" +%Y-%m-%dT%H:%M:%SZ)" --until "$(date -u -d "@$((TO_E + 60))" +%Y-%m-%dT%H:%M:%SZ)" nginx 2>/dev/null \
  | sed -E 's/^[^|]*\| //' > "$W/n.txt"
echo "mistari ya nginx: $(wc -l < "$W/n.txt")"
[ -s "$W/n.txt" ] || alama "b: log ya nginx ya kipindi ni tupu - ushahidi haujakamilika"
echo "mstari wa kwanza: $(head -n 1 "$W/n.txt" | cut -c1-200)"
echo "mstari wa mwisho: $(tail -n 1 "$W/n.txt" | cut -c1-200)"
# <saa ya nginx (UTC)> TAB <ip> TAB <METHOD> TAB <njia bila ?> TAB <HTTP> - login na maombi ya kuandika yanayofuatiliwa tu
awk '
  { n = split($0, q, "\""); if (n < 3) next
    if (!match($0, /\[[0-9][0-9]\/[A-Za-z]+\/[0-9]+:[0-9][0-9]:[0-9][0-9]:[0-9][0-9]/)) next
    t = substr($0, RSTART + 1, RLENGTH - 1)
    split(q[2], rq, " "); m = rq[1]; p = rq[2]; sub(/\?.*/, "", p); st = q[3]; sub(/^ /, "", st); sub(/ .*/, "", st)
    ip = $1; x = q[n - 1]; if (x ~ /^[0-9a-fA-F.:]+(, *[0-9a-fA-F.:]+)*$/) { sub(/,.*/, "", x); ip = x }
    login = (m == "POST" && p ~ /^\/api\/auth\/login\/?$/)
    w = (m ~ /^(POST|PUT|PATCH|DELETE)$/) && (p ~ /^\/api\/(v1\/)?(users|roles|permissions|settings)(\/|$)/ || p ~ /^\/api\/v1\/gl\/(periods|corrections)(\/|$)/ || p ~ /^\/api\/(v1\/)?capital/)
    if (login) print t "\t" ip "\tLOGIN\t" p "\t" st
    else if (w) print t "\t" ip "\t" m "\t" p "\t" st }' "$W/n.txt" > "$W/f.txt"
# saa -> epoch (mara moja kwa kila sekunde; awk ya server huenda haina mktime)
cut -f1 "$W/f.txt" | sort -u > "$W/saa.txt"
: > "$W/map.txt"
while read -r t; do d="${t%%:*}"; r="${t#*:}"; e=$(date -d "$(echo "$d" | tr '/' ' ') $r +0000" +%s 2>/dev/null) && printf '%s\t%s\n' "$t" "$e" >> "$W/map.txt"; done < "$W/saa.txt"
awk -F'\t' -v a="$FROM_E" -v b="$TO_E" 'NR == FNR { m[$1] = $2; next } ($1 in m) && m[$1] >= a && m[$1] <= b + 59 { print m[$1] "\t" $2 "\t" $3 "\t" $4 "\t" $5 }' "$W/map.txt" "$W/f.txt" > "$W/e.txt"
BAD=$(awk -F'\t' 'NR == FNR { m[$1] = 1; next } !($1 in m)' "$W/map.txt" "$W/f.txt" | wc -l)
[ "$BAD" = 0 ] || alama "b: mistari $BAD ya nginx ina saa isiyosomeka"
echo "-- POST /api/auth/login kwa IP (idadi, HTTP) --"
awk -F'\t' '$3 == "LOGIN" { c[$2]++; h[$2 "|" $5]++ } END { for (i in c) { s = ""; for (k in h) { split(k, z, "|"); if (z[1] == i) s = s " HTTP_" z[2] "=" h[k] } print c[i] "\t" i "\t" s } }' "$W/e.txt" \
  | sort -rn | while IFS=$'\t' read -r c ip s; do
      if [ "$ip" = "$OWNER_IP" ]; then echo "  $ip login $c:$s"; else alama "b: login kutoka IP $ip (si ya mmiliki) mara $c:$s"; fi
    done
NL=$(awk -F'\t' '$3 == "LOGIN"' "$W/e.txt" | wc -l); echo "  jumla ya login: $NL"
echo "-- maombi ya kuandika kwenye users/roles/permissions/settings/gl periods/gl corrections/capital --"
awk -F'\t' '$3 != "LOGIN"' "$W/e.txt" | sort -n | while IFS=$'\t' read -r e ip m p st; do
  L="$(eat -d "@$e" '+%F %T') $ip $m $p HTTP_$st"
  if [ "$ip" = "$OWNER_IP" ]; then echo "  $L"; else alama "b: kuandika kutoka IP isiyo ya mmiliki: $L"; fi
done
echo "  jumla ya maombi ya kuandika: $(awk -F'\t' '$3 != "LOGIN"' "$W/e.txt" | wc -l)"

echo "---C-DB-KUSOMA-TU---"
PSQL > "$W/c.txt" 2>&1 <<SQL
SELECT 'READ_ONLY|' || current_setting('transaction_read_only');
SELECT 'ADMIN_SASA|' || coalesce((SELECT status || '|is_root ' || is_root || '|updated_at ' || updated_at::text FROM users WHERE email = 'admin@admin.com'), 'HAIPO');
SELECT format('SELECT %L || (SELECT jsonb_object_agg(k, v) FROM jsonb_each(to_jsonb(t)) e(k, v) WHERE k !~* %L)::text FROM public.%I t WHERE %s ORDER BY 1',
              'SAFU|' || tb.table_name || '|', '(pass|token|secret|otp|pin|hash|salt)', tb.table_name,
              string_agg(format('(%1\$I >= %2\$L AND %1\$I < %3\$L)', c.column_name, '$FROM_EAT', '$TO_EAT'), ' OR '))
  FROM information_schema.tables tb
  JOIN information_schema.columns c ON c.table_schema = tb.table_schema AND c.table_name = tb.table_name AND c.column_name IN ('created_at', 'updated_at')
 WHERE tb.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
   AND tb.table_name IN ('users', 'roles', 'permission_config', 'role_permissions', 'user_roles', 'permissions', 'settings',
                         'business_settings', 'settings_approvals', 'user_branches')
 GROUP BY tb.table_name ORDER BY tb.table_name
\gexec
SELECT 'JEDWALI_LILILOKAGULIWA|' || tb.table_name || '|' || string_agg(c.column_name, ',' ORDER BY c.column_name)
  FROM information_schema.tables tb
  JOIN information_schema.columns c ON c.table_schema = tb.table_schema AND c.table_name = tb.table_name AND c.column_name IN ('created_at', 'updated_at')
 WHERE tb.table_schema = 'public' AND tb.table_type = 'BASE TABLE'
   AND tb.table_name IN ('users', 'roles', 'permission_config', 'role_permissions', 'user_roles', 'permissions', 'settings',
                         'business_settings', 'settings_approvals', 'user_branches')
 GROUP BY tb.table_name ORDER BY 1;
SELECT 'HALINA_SAA|' || x FROM unnest(ARRAY['users', 'roles', 'permission_config', 'role_permissions', 'user_roles', 'permissions', 'settings',
                                            'business_settings', 'settings_approvals', 'user_branches']) x
 WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = x AND c.column_name IN ('created_at', 'updated_at'));
SQL
RC=$?
cut -c1-400 "$W/c.txt"
[ "$RC" = 0 ] || alama "c: psql ya kusoma imeshindwa (exit $RC) - ushahidi haujakamilika"
grep -qx 'READ_ONLY|on' "$W/c.txt" || alama "c: transaction haikuwa READ ONLY - ushahidi haukuthibitishwa"
NS2=$(grep -c '^SAFU|' "$W/c.txt" || true)
echo "safu zilizobadilika ndani ya kipindi: $NS2"
grep '^SAFU|' "$W/c.txt" | cut -d'|' -f2 | sort | uniq -c | while read -r c t; do alama "c: $t: safu $c zenye created_at/updated_at ndani ya kipindi (ziko juu)"; done

echo "---E-DUMP-YA-45A-21/10-11:53-DHIDI-YA-PROD-SASA (kusoma tu)---"
# Dump ya 45a ilichukuliwa 21/10 11:53:14 EAT, kabla admin haijawashwa (15:13:12). Majedwali ya ruhusa/majukumu/matawi
# yanalinganishwa safu kwa safu: pg_restore --data-only ndani ya container (inasoma dump kutoka stdin, haigusi DB yoyote)
# dhidi ya COPY ... TO STDOUT ya prod ndani ya transaction ya READ ONLY, kwa safu zilezile za dump.
DUMP="$HOME/backups/daily/lsms_20261021_1153.dump"
DUMP_SHA=86371c35d8a224d94f9e57130ed5798c38ee8c4d6a19ecd7504de50e75baf5a5
E_TOFAUTI=0; E_SAWA=0
if [ ! -s "$DUMP" ]; then
  alama "e: dump ya 45a ($DUMP) haipo kwenye server - ulinganisho haukufanyika; ushahidi haujakamilika"
elif [ "$(sha256sum "$DUMP" | cut -d' ' -f1)" != "$DUMP_SHA" ]; then
  alama "e: sha256 ya dump ya 45a haifanani na ile ya 45a (86371c35...) - ulinganisho haukufanyika"
else
  echo "dump: $DUMP, sha256 sawa na 45a"
  RO='PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=120000 -c DateStyle=ISO,YMD -c IntervalStyle=postgres -c extra_float_digits=3"'
  for t in user_roles role_permissions user_branches permission_config roles settings business_settings; do
    docker compose exec -T postgres pg_restore --data-only -n public -t "$t" -f - < "$DUMP" > "$W/d-$t.sql" 2> "$W/d-$t.err"
    H=$(tr -d '\r' < "$W/d-$t.sql" | grep -m1 "^COPY public\.$t (")
    P=$(docker compose exec -T postgres sh -c "$RO psql -X -q -At -U \"\${POSTGRES_USER:-postgres}\" -d \"\${POSTGRES_DB:-Lsms}\"" <<SQL
SELECT CASE WHEN to_regclass('public.$t') IS NULL THEN 'HALIPO' ELSE 'LIPO' END;
SQL
)
    if [ -z "$H" ] && [ "$P" = HALIPO ]; then echo "  $t: halipo kwenye dump wala prod"; continue; fi
    if [ -z "$H" ]; then alama "e: $t lipo prod lakini halimo kwenye dump ($(head -c 200 "$W/d-$t.err"))"; E_TOFAUTI=$((E_TOFAUTI + 1)); continue; fi
    if [ "$P" != LIPO ]; then alama "e: $t limo kwenye dump lakini halipo prod"; E_TOFAUTI=$((E_TOFAUTI + 1)); continue; fi
    COLS=$(echo "$H" | sed -E 's/^COPY public\.[^ ]+ \((.*)\) FROM stdin;$/\1/')
    # CR ya mwisho wa mstari inaondolewa pande zote mbili: COPY ya maandishi haina CR halisi ndani ya data (inaandikwa \r)
    tr -d '\r' < "$W/d-$t.sql" | awk -v h="$H" '$0 == h { s = 1; next } s && $0 == "\\." { exit } s' | LC_ALL=C sort > "$W/a-$t.txt"
    # SQL kupitia stdin: majina ya safu yanaweza kuwa na " (maneno ya SQL), yasiingiliane na nukuu za sh -c
    if ! printf 'COPY (SELECT %s FROM public.%s) TO STDOUT;\n' "$COLS" "$t" | docker compose exec -T postgres sh -c "$RO psql -X -q -v ON_ERROR_STOP=1 -U \"\${POSTGRES_USER:-postgres}\" -d \"\${POSTGRES_DB:-Lsms}\"" > "$W/p-$t.raw" 2> "$W/p-$t.err"; then
      alama "e: $t: COPY ya prod imeshindwa ($(head -c 200 "$W/p-$t.err")) - safu za dump hazipo prod?"; E_TOFAUTI=$((E_TOFAUTI + 1)); continue
    fi
    tr -d '\r' < "$W/p-$t.raw" | LC_ALL=C sort > "$W/b-$t.txt"
    LC_ALL=C comm -23 "$W/a-$t.txt" "$W/b-$t.txt" > "$W/old-$t.txt"   # zilikuwepo 21/10 11:53, hazipo sasa (au zimebadilika)
    LC_ALL=C comm -13 "$W/a-$t.txt" "$W/b-$t.txt" > "$W/new-$t.txt"   # zipo sasa, hazikuwepo (au zimebadilika)
    cut -f1 "$W/old-$t.txt" | LC_ALL=C sort -u > "$W/ko-$t.txt"; cut -f1 "$W/new-$t.txt" | LC_ALL=C sort -u > "$W/kn-$t.txt"
    NB=$(LC_ALL=C comm -12 "$W/ko-$t.txt" "$W/kn-$t.txt" | grep -c . || true)
    NO=$(grep -c . "$W/old-$t.txt" || true); NN=$(grep -c . "$W/new-$t.txt" || true)
    ON=$((NO - NB)); NW=$((NN - NB))
    echo "  $t: dump $(grep -c . "$W/a-$t.txt" || true) | prod $(grep -c . "$W/b-$t.txt" || true) | zimeongezwa $NW | zimeondolewa $ON | zimebadilika $NB (ufunguo = safu ya kwanza: $(echo "$COLS" | cut -d, -f1))"
    if [ "$NO" = 0 ] && [ "$NN" = 0 ]; then E_SAWA=$((E_SAWA + 1)); continue; fi
    E_TOFAUTI=$((E_TOFAUTI + 1))
    alama "e: $t: tofauti na dump ya 21/10 11:53 - zimeongezwa $NW, zimeondolewa $ON, zimebadilika $NB (mistari iko juu)"
    echo "    safu: $COLS"
    if [ "$t" = business_settings ] || [ "$t" = settings ]; then
      # thamani zinaweza kuwa za siri: ufunguo na md5 ya safu tu
      awk -F'\t' '{ print "    - kabla  " $1 " md5:" }' "$W/old-$t.txt" | head -n 50 > "$W/x.txt"; paste -d' ' "$W/x.txt" <(head -n 50 "$W/old-$t.txt" | while IFS= read -r l; do printf '%s' "$l" | md5sum | cut -c1-12; done)
      awk -F'\t' '{ print "    + sasa   " $1 " md5:" }' "$W/new-$t.txt" | head -n 50 > "$W/x.txt"; paste -d' ' "$W/x.txt" <(head -n 50 "$W/new-$t.txt" | while IFS= read -r l; do printf '%s' "$l" | md5sum | cut -c1-12; done)
    else
      head -n 50 "$W/old-$t.txt" | tr '\t' '|' | cut -c1-300 | sed 's/^/    - kabla  /'
      head -n 50 "$W/new-$t.txt" | tr '\t' '|' | cut -c1-300 | sed 's/^/    + sasa   /'
    fi
  done
  echo "majedwali yasiyo na tofauti: $E_SAWA; yenye tofauti: $E_TOFAUTI"
  if [ "$E_TOFAUTI" = 0 ]; then
    echo "USHAHIDI_MKUU_E: hakuna safu iliyoongezwa, kuondolewa wala kubadilika kwenye user_roles, role_permissions, user_branches,"
    echo "  permission_config, roles, settings/business_settings kati ya dump ya 21/10 11:53 (kabla admin haijawashwa) na prod sasa."
    echo "E_HAKUNA_TOFAUTI_DUMP_VS_PROD"
  fi
fi

echo "---D-HITIMISHO---"
NAL=$(grep -c . "$W/alama.txt" || true)
echo "ALAMA_JUMLA ${NAL:-0}"
if [ "${NAL:-0}" = 0 ]; then
  echo "Ushahidi mkuu: E_HAKUNA_TOFAUTI_DUMP_VS_PROD (ruhusa, majukumu na matawi ni yaleyale ya kabla ya 21/10 15:13)."
  echo "HITIMISHO HAKUNA_USHAHIDI_WA_MATUMIZI"
else
  sed 's/^/  /' "$W/alama.txt"
  echo "HITIMISHO ORODHA"
fi
echo "---USHAHIDI_56_UMEKAMILIKA---"
exit 0
