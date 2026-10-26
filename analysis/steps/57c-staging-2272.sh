#!/usr/bin/env bash
# HATUA 57c (mmiliki 26/10 b, k, l) - STAGING inawasha backend 2.2.72 kwa RESTART HALISI, ikizungukwa na hali-root.sh staging KABLA/BAADA.
# INABADILISHA STAGING TU (~/lsms-staging: BACKEND_VERSION kwenye .env, admin@admin.com -> INACTIVE kwenye DB ya staging,
#   container ya backend). Prod haiguswi (ps kabla/baada).
# Inaendeshwa kwenye Contabo na 57c-staging-2272.cmd (scp -> /tmp; output -> ficha.awk).
# Hali ya .env: MPYA (2.2.71 -> 2.2.72, backup .env.bak.kabla-ya-2272-toleo) / RUDIA (2.2.72 + backup) / KATAA.
# Mpangilio (26/10 l):
#   0) kinga ya STAGING: folda, label za compose za postgres, postgres si ile ya prod -> vinginevyo HALI_57C_KATAA bila kubadilisha kitu
#   1) admin@admin.com ikiwa ACTIVE -> UPDATE users SET status='INACTIVE' WHERE id=9 AND email='admin@admin.com' (rows lazima 1)
#   2) hali-root KABLA -> admin lazima INACTIVE
#   3) restart na 2.2.72; digest ya 57a inathibitishwa (pull na container)
#   4) hali-root BAADA -> admin bado INACTIVE na updated_at ile ile; root@system.com ACTIVE; boot haina "Activating ROOT user: admin@admin.com"
#   5) Flyway: idadi ya migrations (na toleo la mwisho) kabla = baada
set -u -o pipefail
cd ~/lsms-staging || { echo "HALI_57C_KATAA ~/lsms-staging haipo"; exit 1; }
[ -s /tmp/hali-root.sh ] || { echo "HALI_57C_KATAA /tmp/hali-root.sh haipo"; exit 1; }
DC() { docker compose -p lsms-staging "$@"; }
fail() { echo "SIYO: $*"; exit 1; }
kataa() { echo "HALI_57C_KATAA $*"; exit 1; }
B=.env.bak.kabla-ya-2272-toleo
# digest ya 57a (mmiliki 26/10 k): tag peke yake haitoshi; tofauti -> SIMAMA
DG=sha256:ad3c59458436a043cf795390d5c334a48984a16ed2e149cc72bd533edb43359a
ne() { grep -c "^$1=" "$2" 2>/dev/null; }
ve() { sed -n "s/^$1=//p" "$2" | head -n1; }
PSQL() { DC exec -T postgres psql -X -q -v ON_ERROR_STOP=1 -U postgres -d Lsms -At "$@"; }
fly() { PSQL -c "select count(*) || ' ' || coalesce((select version from flyway_schema_history where success order by installed_rank desc limit 1), '-') from flyway_schema_history where success"; }
img() { DC ps --format '{{.Image}}' backend | head -n1; }
# mstari wa hali-root wa akaunti: hr <output> <lebo> <email>
hr() { printf '%s\n' "$1" | grep "^HALI_ROOT|$2|staging|$3|" | head -n1; }
hs() { printf '%s\n' "$1" | cut -d'|' -f6; }
hu() { printf '%s\n' "$1" | sed -n 's/.*|updated_at \([^|]*\)|.*/\1/p'; }

echo "---KINGA-YA-STAGING---"
H=$(pwd -P); HS="$(cd ~ && pwd -P)/lsms-staging"
[ "$H" = "$HS" ] || kataa "folda $H si $HS"
SPG=$(DC ps -q postgres | head -n1)
[ -n "$SPG" ] || kataa "postgres ya compose lsms-staging haiendeshi"
LP=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$SPG")
LW=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' "$SPG")
echo "postgres ya staging: ${SPG:0:12} project [$LP] working_dir [$LW]"
[ "$LP" = lsms-staging ] || kataa "postgres si ya project lsms-staging ($LP)"
[ "$LW" = "$H" ] || kataa "postgres si ya folda $H ($LW)"
PPG=$(cd ~/lsms-deployment 2>/dev/null && docker compose ps -q postgres 2>/dev/null | head -n1)
echo "postgres ya prod: ${PPG:0:12}"
[ -n "$PPG" ] && [ "$SPG" = "$PPG" ] && kataa "postgres ya staging ndiyo ya prod"
echo "NI_STAGING"

echo "---PROD-PS-KABLA---"
P1=$(cd ~/lsms-deployment && docker compose ps --format '{{.Service}} {{.Image}} {{.State}}' | sort); echo "$P1"
echo "---KINGA-ZA-57B---"
[ "$(ne ROOT_EMAIL .env)" = 1 ] && [ "$(ve ROOT_EMAIL .env)" = root@system.com ] || fail "ROOT_EMAIL ya .env ya staging si root@system.com - endesha 57b"
[ "$(ne ROOT_PASSWORD .env)" = 0 ] || fail ".env ya staging bado ina ROOT_PASSWORD - endesha 57b"
echo "ENV_YA_57B_SAWA"
echo "---TOLEO-LA-ENV---"
V=$(ve BACKEND_VERSION .env); N=$(ne BACKEND_VERSION .env)
echo "env TOLEO_ENV_$(echo "$V" | tr -dc '0-9'), mistari $N; backend inayoendesha $(img)"
if [ "x$N" = x1 ] && [ "$V" = 2.2.71 ] && [ ! -e "$B" ]; then
  cp -p .env "$B" && sed -i 's/^BACKEND_VERSION=.*/BACKEND_VERSION=2.2.72/' .env || fail "kubadilisha toleo kumeshindwa"
  echo "HALI_57C_MPYA"
elif [ "x$N" = x1 ] && [ "$V" = 2.2.72 ] && [ -f "$B" ]; then
  echo "HALI_57C_RUDIA"
else
  echo "HALI_57C_KATAA"; exit 1
fi
X=$(diff "$B" .env | grep '^[<>]' | grep -vc '^[<>] BACKEND_VERSION=')
[ "x$X" = x0 ] || fail ".env ina tofauti isiyo ya BACKEND_VERSION na $B"
[ "$(ve BACKEND_VERSION .env)" = 2.2.72 ] || fail "toleo la env si 2.2.72"
echo "TOLEO_ENV_2272"
echo "---FLYWAY-KABLA (idadi toleo)---"
F1=$(fly) || fail "flyway haisomeki (postgres ya staging inawaka?)"; echo "flyway kabla: $F1"
[ -n "$F1" ] || fail "flyway tupu"
echo "---PULL-IMAGE-NA-DIGEST---"
DC pull -q backend || fail "pull imeshindwa"
docker image inspect chiefmaster/my-lsms-backend:2.2.72 --format '{{index .RepoDigests 0}}' || fail "image 2.2.72 haipo"
RD=$(docker image inspect chiefmaster/my-lsms-backend:2.2.72 --format '{{join .RepoDigests " "}}')
echo "$RD" | tr ' ' '\n' | grep -qx "chiefmaster/my-lsms-backend@$DG" || fail "digest ya tag 2.2.72 si $DG ($RD) - SIMAMA"
DI=$(docker image inspect chiefmaster/my-lsms-backend@$DG --format '{{.Id}}') && [ -n "$DI" ] || fail "image ya digest $DG haipo"
echo "DIGEST_PULL_SAWA"

echo "---ADMIN-INACTIVE-KWENYE-STAGING (26/10 l.1)---"
A0=$(PSQL -F'|' -c "select id, email, status, is_root, updated_at from users where email = 'admin@admin.com'") || fail "kusoma admin kumeshindwa"
echo "admin kabla: ${A0:-HAIPO}"
case "$A0" in
  "9|admin@admin.com|ACTIVE|"*)
    R=$(PSQL <<'SQL'
BEGIN;
CREATE TEMP TABLE r57c (n int);
DO $$ DECLARE c int; BEGIN
  UPDATE users SET status = 'INACTIVE' WHERE id = 9 AND email = 'admin@admin.com';
  GET DIAGNOSTICS c = ROW_COUNT;
  INSERT INTO r57c VALUES (c);
  IF c <> 1 THEN RAISE EXCEPTION 'ADMIN_UPDATE_ROWS % (lazima 1) - rollback', c; END IF;
END $$;
SELECT 'ADMIN_UPDATE_ROWS ' || n FROM r57c;
COMMIT;
SQL
) || fail "UPDATE ya admin imeshindwa (rollback)"
    echo "$R"
    echo "$R" | grep -qx 'ADMIN_UPDATE_ROWS 1' || fail "UPDATE ya admin haikuwa rows=1"
    echo "ADMIN_IMEFANYWA_INACTIVE" ;;
  "9|admin@admin.com|INACTIVE|"*) echo "ADMIN_TAYARI_INACTIVE (hakuna UPDATE)" ;;
  *) fail "admin@admin.com si id 9 ACTIVE/INACTIVE kama ilivyotarajiwa - SIMAMA" ;;
esac
echo "admin sasa: $(PSQL -F'|' -c "select id, email, status, is_root, updated_at from users where email = 'admin@admin.com'")"

echo "---HALI-ROOT-KABLA (26/10 l.2)---"
HK=$(bash /tmp/hali-root.sh staging KABLA) || fail "hali-root KABLA imeshindwa"
echo "$HK"
AK=$(hr "$HK" KABLA admin@admin.com); RK=$(hr "$HK" KABLA root@system.com)
[ "$(hs "$AK")" = INACTIVE ] || fail "KABLA: admin si INACTIVE ($(hs "$AK"))"
UK=$(hu "$AK"); [ -n "$UK" ] || fail "KABLA: updated_at ya admin haisomeki"
[ "$(hs "$RK")" = ACTIVE ] || fail "KABLA: root@system.com si ACTIVE"
echo "KABLA_ADMIN_INACTIVE updated_at $UK"

echo "---RESTART-HALISI-BACKEND-2.2.72 (26/10 l.3)---"
S=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DC up -d backend || fail "up -d backend imeshindwa"
for i in $(seq 1 60); do DC logs --no-color --since "$S" backend 2>&1 | grep -q -E 'Started LsmsApplication|APPLICATION FAILED|Application run failed' && break; sleep 5; done
LG=$(DC logs --no-color --since "$S" backend 2>&1 | sed -E 's/^[^|]*\| //')
echo "$LG" | grep -E 'DataInitializer.*(ROOT|root)|Current version of schema|Successfully applied|No migration necessary|Started LsmsApplication|APPLICATION FAILED' | cut -c1-260
echo "$LG" | grep -q 'Started LsmsApplication' || fail "backend haikuwaka"
[ "$(img)" = chiefmaster/my-lsms-backend:2.2.72 ] || fail "backend haiendeshi 2.2.72 ($(img))"
echo "BACKEND_INAYOENDESHA_2272"
CI=$(docker inspect --format '{{.Image}}' "$(DC ps -q backend)")
[ -n "$CI" ] && [ "$CI" = "$DI" ] || fail "container ya backend si image ya digest $DG ($CI vs $DI) - SIMAMA"
echo "DIGEST_INAYOENDESHA_SAWA"
echo "$LG" | grep -q 'Activating ROOT user: admin@admin.com' && fail "boot imewasha admin@admin.com"
echo "$LG" | grep -q 'Creating ROOT user' && fail "boot imeunda ROOT user"
echo "$LG" | grep -qE 'Setting isRoot flag' && fail "boot imepandisha akaunti"
echo "BOOT_HAIKUWASHA_ADMIN (hakuna 'Activating ROOT user: admin@admin.com', kuunda wala kupandisha)"

echo "---HALI-ROOT-BAADA (26/10 l.4)---"
HB=$(bash /tmp/hali-root.sh staging BAADA) || fail "hali-root BAADA imeshindwa"
echo "$HB"
AB=$(hr "$HB" BAADA admin@admin.com); RB=$(hr "$HB" BAADA root@system.com)
[ "$(hs "$AB")" = INACTIVE ] || fail "BAADA: admin si INACTIVE tena ($(hs "$AB"))"
UB=$(hu "$AB")
[ "$UB" = "$UK" ] || fail "BAADA: updated_at ya admin imebadilika ($UK -> $UB)"
echo "BAADA_ADMIN_INACTIVE updated_at $UB (haijabadilika)"
[ "$(hs "$RB")" = ACTIVE ] || fail "BAADA: root@system.com si ACTIVE ($(hs "$RB"))"
echo "$RB" | grep -q '|is_root true|' || fail "BAADA: root@system.com si is_root"
echo "BAADA_ROOT_SYSTEM_ACTIVE"
echo "$HB" | grep -qx HALI_ROOT_SAWA || fail "restart imebadilisha safu ya root/admin"
echo "ADMIN_ROOT_BAADA_SAWA"

echo "---FLYWAY-BAADA (26/10 l.5)---"
F2=$(fly); echo "flyway baada: $F2"
[ "$F1" = "$F2" ] || fail "flyway imebadilika ($F1 -> $F2) - 2.2.72 haipaswi kuwa na migration"
echo "FLYWAY_HAIJABADILIKA"
echo "---ERROR-ZA-BOOT---"
echo "mistari ya ERROR tangu restart: $(echo "$LG" | grep -c ' ERROR ')"
echo "$LG" | grep ' ERROR ' | head -n 10 | cut -c1-260
echo "---PROD-PS-BAADA---"
P2=$(cd ~/lsms-deployment && docker compose ps --format '{{.Service}} {{.Image}} {{.State}}' | sort); echo "$P2"
[ "$P1" = "$P2" ] || fail "prod ps imebadilika wakati wa 57c"
echo "PROD_HAIJAGUSWA"
echo "---57C_SERVER_MWISHO---"
exit 0
