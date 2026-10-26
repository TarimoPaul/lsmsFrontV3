#!/usr/bin/env bash
# HATUA 52c (mmiliki 21/10: admin@admin.com iondolewe kabisa na isiundwe tena) - INAANDIKA KWENYE DB YA PROD.
# Hii ni ANDIKO LA MOJA KWA MOJA kwenye DB ya prod (psql ndani ya container) - kinyume na kanuni ya 15/10 ("hakuna query
# kwenye DB ya prod"); inaruhusiwa tu kwa uamuzi wa mmiliki, mara moja, kwa kinga hizi. Inaendeshwa NYUMA kwenye Contabo
# (45-bg.sh) na 52c-prod-admin-ondoa.cmd.
# Matumizi: bash 52c-admin-ondoa.sh <DELETE|TOMBSTONE>   (uamuzi unatoka kwenye 52b - marejeo kwenye nakala ya 02:00)
# Kinga za MPANGILIO (zote lazima): backend ni 2.2.72 (boot haiundi root ikiwa root ipo); ROOT_EMAIL ya .env NA ya backend
# ni root@system.com; ROOT_PASSWORD haipo kwenye .env; root@system.com ni root ACTIVE. Vinginevyo boot ya 2.2.71 ingeunda
# admin@admin.com upya kama ROOT kwa password inayojulikana.
#  DELETE    : marejeo ya FK yanahesabiwa TENA ndani ya transaction ileile; > 0 = ROLLBACK (hakuna kinachofutwa).
#  TOMBSTONE : INACTIVE, is_root=false, is_admin=false, email deleted+admin@invalid, password si BCrypt (haiwezi kulingana
#              na password yoyote), email_verified=false, reset_token NULL.
# Kabla ya kuandika: nakala ya jedwali users (data tu) ~/backups/52c-users-<saa>.sql (chmod 600 - ina hash za password).
# Baada ya kuandika: restart ya backend; admin@admin.com lazima iwe 0 (haikuundwa upya), root@system.com bado root ACTIVE,
# na hakuna "Creating ROOT user" kwenye log. Kurudia: ikiwa admin@admin.com haipo tena (na kazi ilikamilika) inathibitisha tu.
set -u -o pipefail
M="${1:-}"
case "$M" in DELETE|TOMBSTONE) ;; *) echo "SIYO: uamuzi lazima uwe DELETE au TOMBSTONE: [$M]"; exit 1 ;; esac
cd ~/lsms-deployment || exit 1
PSQL() { docker compose exec -T postgres sh -c 'psql -X -q -v ON_ERROR_STOP=1 -At -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"'; }
fail() { echo "SIYO: $*"; exit 1; }

echo "---KINGA-ZA-MPANGILIO---"
IMG=$(docker compose ps backend --format '{{.Image}}' | head -n1); echo "backend: $IMG"
case "$IMG" in *:2.2.72) ;; *) fail "backend si 2.2.72 - boot ya zamani ingeunda admin@admin.com upya kama root" ;; esac
RE=$(docker compose exec -T backend sh -c 'printf %s "${ROOT_EMAIL:-HAIJAWEKWA}"' < /dev/null)
echo "ROOT_EMAIL_YA_BACKEND [$RE]"
[ "$RE" = root@system.com ] || fail "ROOT_EMAIL ya backend si root@system.com - endesha 45i kwanza"
[ "$(grep -c '^ROOT_EMAIL=root@system.com$' .env)" = 1 ] || fail ".env haina ROOT_EMAIL=root@system.com mstari 1"
[ "$(grep -c '^ROOT_PASSWORD=' .env)" = 0 ] || fail ".env bado ina ROOT_PASSWORD"
echo KINGA_ZA_MPANGILIO_SAWA

echo "---HALI-KABLA---"
H=$(PSQL <<'SQL'
SELECT 'ROOT_SYSTEM ' || count(*) FROM users WHERE email = 'root@system.com' AND is_root AND status = 'ACTIVE' AND NOT is_deleted;
SELECT 'ADMIN ' || count(*) FROM users WHERE email = 'admin@admin.com';
SELECT 'TOMBSTONE_IPO ' || count(*) FROM users WHERE email = 'deleted+admin@invalid';
SQL
) || fail "psql ya kusoma imeshindwa"
echo "$H"
echo "$H" | grep -qx 'ROOT_SYSTEM 1' || fail "root@system.com si root ACTIVE - SIMAMA"
ADMIN=$(echo "$H" | sed -n 's/^ADMIN //p'); TOMB=$(echo "$H" | sed -n 's/^TOMBSTONE_IPO //p')
if [ "$ADMIN" = 0 ]; then
  if [ "$M" = TOMBSTONE ] && [ "$TOMB" != 1 ]; then fail "admin@admin.com haipo na tombstone haipo - hali isiyotarajiwa"; fi
  echo "admin@admin.com haipo tena - kazi ilishafanyika (kurudia); inathibitisha tu"
else
  [ "$ADMIN" = 1 ] || fail "admin@admin.com ina safu $ADMIN"
  [ "$TOMB" = 0 ] || fail "deleted+admin@invalid tayari ipo"

  echo "---NAKALA-YA-USERS---"
  BK="$HOME/backups/52c-users-$(date +%Y%m%d_%H%M%S).sql"
  (umask 077; docker compose exec -T postgres sh -c 'pg_dump -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}" --data-only -t public.users' > "$BK") || fail "pg_dump ya users imeshindwa"
  [ -s "$BK" ] && grep -q 'COPY public.users' "$BK" || fail "nakala ya users ni tupu"
  echo "nakala: $BK ($(stat -c %s "$BK") bytes, chmod $(stat -c %a "$BK"))"

  echo "---ANDIKA-$M---"
  if [ "$M" = DELETE ]; then
    PSQL <<'SQL' || fail "DELETE imeshindwa - transaction imerudishwa (ROLLBACK), hakuna kilichofutwa"
BEGIN;
DO $$
DECLARE a_id bigint; a_uid text; r record; n bigint; jumla bigint := 0;
BEGIN
  SELECT id, uid::text INTO a_id, a_uid FROM users WHERE email = 'admin@admin.com' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ADMIN_HAYUPO'; END IF;
  FOR r IN
    SELECT cl.relname AS t, a.attname AS c
    FROM pg_constraint co JOIN pg_class cl ON cl.oid = co.conrelid
    JOIN LATERAL unnest(co.conkey) k(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = k.attnum
    WHERE co.contype = 'f' AND co.confrelid = 'public.users'::regclass
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text IN ($1, $2)', r.t, r.c) INTO n USING a_id::text, coalesce(a_uid, '__hakuna_uid__');
    IF n > 0 THEN RAISE NOTICE 'MAREJEO FK %.% = %', r.t, r.c, n; jumla := jumla + n; END IF;
  END LOOP;
  IF jumla > 0 THEN RAISE EXCEPTION 'MAREJEO_FK_YAPO % - tumia TOMBSTONE', jumla; END IF;
  DELETE FROM users WHERE id = a_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'DELETE ilifuta safu %', n; END IF;
  RAISE NOTICE 'ADMIN_IMEFUTWA id %', a_id;
END $$;
COMMIT;
SQL
  else
    PSQL <<'SQL' || fail "TOMBSTONE imeshindwa - transaction imerudishwa (ROLLBACK), hakuna kilichobadilika"
BEGIN;
DO $$
DECLARE n bigint; seti text;
BEGIN
  seti := 'status = ''INACTIVE'', is_root = false, is_admin = false, email_verified = false, reset_token = NULL,'
       || ' email = ''deleted+admin@invalid'','
       || ' password = ''!tombstone-'' || md5(random()::text || clock_timestamp()::text)';
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at') THEN
    seti := seti || ', updated_at = now()';
  END IF;
  EXECUTE 'UPDATE users SET ' || seti || ' WHERE email = ''admin@admin.com''';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'TOMBSTONE ilibadilisha safu %', n; END IF;
  IF (SELECT count(*) FROM users WHERE email = 'deleted+admin@invalid' AND status = 'INACTIVE' AND NOT is_root) <> 1 THEN
    RAISE EXCEPTION 'TOMBSTONE haionekani baada ya UPDATE';
  END IF;
  RAISE NOTICE 'ADMIN_TOMBSTONE_IMEWEKWA';
END $$;
COMMIT;
SQL
  fi
fi

echo "---RESTART-BACKEND-NA-UTHIBITISHO---"
S=$(date -u +%Y-%m-%dT%H:%M:%SZ)
docker compose restart backend || fail "restart imeshindwa"
for i in $(seq 1 60); do LG=$(docker compose logs --no-color --since "$S" backend 2>&1); grep -q -E 'Started LsmsApplication|APPLICATION FAILED' <<< "$LG" && break; sleep 3; done
LG=$(docker compose logs --no-color --since "$S" backend 2>&1)
grep -q 'Started LsmsApplication' <<< "$LG" || fail "backend haikuwaka baada ya restart"
grep -E 'DataInitializer.*(ROOT|root\.email)' <<< "$LG" | sed -E 's/^[^|]*\| //' | cut -c1-200
grep -q 'Creating ROOT user' <<< "$LG" && fail "boot imeunda ROOT user - SIMAMA"
A=$(PSQL <<'SQL'
SELECT 'ADMIN_BAADA ' || count(*) FROM users WHERE email = 'admin@admin.com';
SELECT 'ROOT_SYSTEM_BAADA ' || count(*) FROM users WHERE email = 'root@system.com' AND is_root AND status = 'ACTIVE' AND NOT is_deleted;
SELECT 'ROOTS_WOTE ' || count(*) FROM users WHERE is_root;
SELECT 'TOMBSTONE ' || status || ' is_root=' || is_root FROM users WHERE email = 'deleted+admin@invalid';
SQL
) || fail "psql ya kusoma baada imeshindwa"
echo "$A"
echo "$A" | grep -qx 'ADMIN_BAADA 0' || fail "admin@admin.com bado ipo / imeundwa upya"
echo "$A" | grep -qx 'ROOT_SYSTEM_BAADA 1' || fail "root@system.com si root ACTIVE baada ya restart"
echo ADMIN_HAIPO_BAADA_YA_RESTART
echo ROOT_SYSTEM_SAWA
echo ---OK---
