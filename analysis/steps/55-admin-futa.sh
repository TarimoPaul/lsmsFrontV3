#!/usr/bin/env bash
# HATUA 55 (mmiliki 26/10; inachukua nafasi ya toleo la tombstone) - KUFUTA KABISA admin@admin.com kwenye DB ya prod.
# INAANDIKA KWENYE DB YA PROD (psql ndani ya container) - kwa uamuzi wa mmiliki tu, baada ya 56 = HAKUNA_USHAHIDI_WA_MATUMIZI.
# Inaendeshwa kwenye Contabo na 55-prod-admin-futa.cmd: /tmp/55-admin-futa.sh, /tmp/55-admin-futa.sql, /tmp/hali-root.sh.
# Matumizi: bash 55-admin-futa.sh <kagua|futa>
#   kagua : kinga zote + SQL ya 55 ndani ya BEGIN READ ONLY ... ROLLBACK (hakuna kuandika) -> KAGUA_55_SAWA
#   futa  : kinga zote; nakala ya safu ya users id=9 + user_branches yake (bila safu za siri) ~/backups/55-admin-<saa>.json
#           (chmod 600); SQL ya 55 (transaction: DELETE user_branches, DELETE users; safu 1 kila moja; vinginevyo ROLLBACK)
#           -> ADMIN_IMEFUTWA_55
#   Zote: baada -> admin 0, users 8, is_root 1, root@system.com ACTIVE -> BAADA_SAWA_55; hali-root.sh prod SASA.
#   Kurudia baada ya kufuta (admin haipo, users 8, is_root 1): ADMIN_ILISHAFUTWA_55 - inathibitisha tu, haiandiki.
# HAITEGEMEI 2.2.72 na HAIFANYI restart (mmiliki 26/10). Kinga: ROOT_EMAIL_YA_BACKEND [root@system.com]; root@system.com
#   ipo, ACTIVE, is_root. Kinga za 56 (HAKUNA_USHAHIDI_WA_MATUMIZI, leo) na neno FUTA la mmiliki ziko kwenye .cmd.
set -u -o pipefail
M="${1:-}"
case "$M" in kagua|futa) ;; *) echo "IMEKATALIWA_55 hali lazima iwe kagua au futa: [$M]"; exit 1 ;; esac
cd ~/lsms-deployment || exit 1
fail() { echo "IMEKATALIWA_55 $*"; exit 1; }
[ -s /tmp/hali-root.sh ] || fail "/tmp/hali-root.sh haipo"
[ -s /tmp/55-admin-futa.sql ] || fail "/tmp/55-admin-futa.sql haipo"
PSQLRO() { docker compose exec -T postgres sh -c 'PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=60000" psql -X -q -v ON_ERROR_STOP=1 -At -F"|" -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-Lsms}"'; }
# hali imethibitishwa juu (kagua|futa), kwa hiyo inaingizwa kwenye amri bila hatari
PSQL55() { docker compose exec -T postgres sh -c "psql -X -q -At -v ON_ERROR_STOP=1 -v hali=$M -U \"\${POSTGRES_USER:-postgres}\" -d \"\${POSTGRES_DB:-Lsms}\"" < /tmp/55-admin-futa.sql; }
A_UID=5e0e9b5c-863c-4719-a196-947f98f0819c

echo "---KINGA-ZA-MPANGILIO---"
echo "backend: $(docker compose ps backend --format '{{.Image}}' | head -n1) (taarifa - 55 haitegemei toleo)"
RE=$(docker compose exec -T backend sh -c 'printf %s "${ROOT_EMAIL:-HAIJAWEKWA}"' < /dev/null)
echo "ROOT_EMAIL_YA_BACKEND [$RE]"
[ "$RE" = root@system.com ] || fail "ROOT_EMAIL ya backend si root@system.com"

echo "---HALI-YA-ROOT-SASA-KABLA---"
bash /tmp/hali-root.sh prod SASA || fail "hali-root.sh SASA imeshindwa"

hali_db() {
  PSQLRO <<SQL
SELECT 'ADMIN ' || count(*) FROM users WHERE id = 9 AND email = 'admin@admin.com' AND uid::text = '$A_UID';
SELECT 'ADMIN_YOYOTE ' || count(*) FROM users WHERE id = 9 OR email = 'admin@admin.com' OR uid::text = '$A_UID';
SELECT 'USERS ' || count(*) FROM users;
SELECT 'ROOTS ' || count(*) FROM users WHERE is_root;
SELECT 'ROOT_SYSTEM ' || count(*) FROM users WHERE email = 'root@system.com' AND is_root AND status = 'ACTIVE' AND NOT is_deleted;
SQL
}
thamani() { echo "$H" | sed -n "s/^$1 //p"; }

echo "---HALI-YA-DB-KABLA---"
H=$(hali_db) || fail "psql ya kusoma imeshindwa"
echo "$H"
[ "$(thamani ROOT_SYSTEM)" = 1 ] || fail "root@system.com si root ACTIVE"

if [ "$(thamani ADMIN_YOYOTE)" = 0 ]; then
  [ "$(thamani USERS)" = 8 ] && [ "$(thamani ROOTS)" = 1 ] || fail "admin haipo lakini users/is_root si 8/1 - hali isiyotarajiwa"
  echo "kurudia: admin ilishafutwa - hakuna kinachoandikwa"
  echo "ADMIN_ILISHAFUTWA_55"
elif [ "$(thamani ADMIN)" != 1 ]; then
  fail "safu ya admin haifanani na id=9 + email + uid (ADMIN $(thamani ADMIN), ADMIN_YOYOTE $(thamani ADMIN_YOYOTE))"
else
  if [ "$M" = futa ]; then
    echo "---NAKALA-YA-ADMIN-KABLA-YA-KUFUTA---"
    mkdir -p "$HOME/backups" || fail "~/backups haipo"
    BK="$HOME/backups/55-admin-$(date +%Y%m%d_%H%M%S).json"
    (umask 077; PSQLRO > "$BK" <<SQL
SELECT 'USER|' || (SELECT jsonb_object_agg(k, v) FROM jsonb_each(to_jsonb(u)) e(k, v) WHERE k !~* '(pass|token|secret|otp|pin|hash|salt)')::text
  FROM users u WHERE id = 9 AND email = 'admin@admin.com' AND uid::text = '$A_UID';
SELECT 'USER_BRANCHES|' || to_jsonb(b)::text FROM user_branches b WHERE b.user_uid::text = '$A_UID';
SQL
    ) || fail "nakala ya admin haikuandikwa - hakuna kilichofutwa"
    chmod 600 "$BK"
    [ "$(grep -c '^USER|' "$BK")" = 1 ] && grep -q "$A_UID" "$BK" || fail "nakala ya admin haina safu ya users - hakuna kilichofutwa"
    [ "$(grep -c '^USER_BRANCHES|' "$BK")" = 1 ] || fail "nakala haina user_branches 1 - hakuna kilichofutwa"
    ! grep -qiE '"(password|reset_token)"' "$BK" || fail "nakala ina safu ya siri - hakuna kilichofutwa"
    echo "nakala: $BK ($(stat -c %s "$BK") bytes, chmod $(stat -c %a "$BK"); USER 1, USER_BRANCHES 1, bila password/token)"
  fi
  echo "---SQL-YA-55-HALI-$M---"
  OUT=$(PSQL55 2>&1); RC=$?
  echo "$OUT" | sed -E 's/^psql:[^:]*:[0-9]+: (NOTICE|ERROR): +//' | cut -c1-300
  echo "[psql exit $RC]"
  [ "$RC" = 0 ] || fail "SQL ya 55 imekataa - transaction imerudishwa (ROLLBACK), hakuna kilichobadilika"
  echo "$OUT" | grep -q 'KINGA_55_SAWA' || fail "SQL haikutoa KINGA_55_SAWA"
  if [ "$M" = kagua ]; then
    echo "$OUT" | grep -qx 'KAGUA_55_ROLLBACK' || fail "kagua haikuisha kwa ROLLBACK"
    echo "KAGUA_55_SAWA"
  else
    echo "$OUT" | grep -q 'ADMIN_IMEFUTWA_55' && echo "$OUT" | grep -qx 'COMMIT_55' || fail "futa haikuthibitisha DELETE + COMMIT"
    echo "ADMIN_IMEFUTWA_55"
  fi
fi

echo "---HALI-YA-DB-BAADA---"
H=$(hali_db) || fail "psql ya kusoma baada imeshindwa"
echo "$H"
if [ "$M" = futa ] || [ "$(thamani ADMIN_YOYOTE)" = 0 ]; then
  [ "$(thamani ADMIN_YOYOTE)" = 0 ] || fail "admin bado ipo"
  [ "$(thamani USERS)" = 8 ] || fail "users si 8"
  [ "$(thamani ROOTS)" = 1 ] || fail "is_root si 1"
  [ "$(thamani ROOT_SYSTEM)" = 1 ] || fail "root@system.com si root ACTIVE"
  echo "BAADA_SAWA_55"
else
  [ "$(thamani ADMIN)" = 1 ] && [ "$(thamani USERS)" = 9 ] || fail "kagua ilibadilisha hali ya DB"
  echo "KAGUA_HAIKUBADILISHA_KITU"
fi
echo "---HALI-YA-ROOT-SASA-BAADA---"
bash /tmp/hali-root.sh prod SASA || fail "hali-root.sh SASA imeshindwa"
echo "---55_SERVER_MWISHO---"
exit 0
